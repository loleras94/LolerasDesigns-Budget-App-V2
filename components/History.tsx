

import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { Transaction, InvestmentTransaction, TransactionType, CostCategory, InvestmentTransactionType, Currency, InvestmentType, ReportData, InvestmentHolding } from '../types';
import MonthlyReport from './MonthlyReport';
import { SpinnerIcon, ArrowDownIcon, ArrowUpIcon, SwitchHorizontalIcon, ArrowDownTrayIcon } from './Icons';
import { useLanguage } from '../context/LanguageContext';
import { CRYPTOCURRENCIES } from '../constants/crypto';

type DisplayTransaction = {
    id: string;
    date: string;
    description: string;
    amount: number;
    isPositive: boolean;
    currencySymbol: string;
    accountName: string;
    details: string;
    Icon: React.FC<React.SVGProps<SVGSVGElement>>;
    color: string;
};

const TransactionRow: React.FC<{ transaction: DisplayTransaction }> = ({ transaction }) => {
    const { locale } = useLanguage();
    const { Icon, color, isPositive, currencySymbol, amount, description, date, details, accountName } = transaction;

    return (
        <li className="flex items-center justify-between p-3 bg-gray-700/50 rounded-md">
            <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-full ${color.replace('text-', 'bg-').replace('400', '500/20')}`}>
                    <Icon className={`${color} h-5 w-5`} />
                </div>
                <div>
                    <p className="font-medium text-gray-100">{description}</p>
                    <p className="text-xs text-gray-400">{accountName} &middot; {new Date(date).toLocaleDateString(locale)}</p>
                    <p className="text-xs text-gray-500">{details}</p>
                </div>
            </div>
            <span className={`font-semibold ${color}`}>
                {isPositive ? '+' : '-'}{currencySymbol}{amount.toFixed(2)}
            </span>
        </li>
    );
};


const History: React.FC = () => {
    const { transactions, accounts, investmentTransactions, investmentHoldings, convertCurrency, reports, saveReport, getCurrencySymbol, monthlySummaries } = useAppContext();
    const { t } = useLanguage();

    const [activeView, setActiveView] = useState<'reports' | 'transactions'>('reports');
    const [selectedYear, setSelectedYear] = useState<string>('');
    const [selectedMonth, setSelectedMonth] = useState<string>('');
    const [reportData, setReportData] = useState<ReportData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const availableYears = useMemo(() => {
        const years = new Set<number>();
        transactions.forEach(t => years.add(new Date(t.date).getUTCFullYear()));
        investmentTransactions.forEach(t => years.add(new Date(t.date).getUTCFullYear()));
        return Array.from(years).sort((a, b) => b - a);
    }, [transactions, investmentTransactions]);

    const availableMonths = useMemo(() => {
        if (!selectedYear) return [];
        const year = parseInt(selectedYear);
        const months = new Set<number>();
        transactions.forEach(t => {
            const d = new Date(t.date);
            if (d.getUTCFullYear() === year) months.add(d.getUTCMonth());
        });
        investmentTransactions.forEach(t => {
            const d = new Date(t.date);
            if (d.getUTCFullYear() === year) months.add(d.getUTCMonth());
        });

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        let monthArray = Array.from(months);
        
        if (activeView === 'reports' && year === currentYear) {
            monthArray = monthArray.filter(m => m < currentMonth);
        }

        return monthArray.sort((a, b) => a - b);
    }, [selectedYear, transactions, investmentTransactions, activeView]);

    useEffect(() => {
        if (availableYears.length > 0 && !selectedYear) {
            setSelectedYear(String(availableYears[0]));
        }
    }, [availableYears, selectedYear]);
    
    useEffect(() => {
        if (!selectedYear) return;
    
        if (availableMonths.length > 0) {
            const latestMonth = String(availableMonths[availableMonths.length - 1]);
            setSelectedMonth(latestMonth);
        } else {
            setSelectedMonth('');
        }
        setReportData(null);
        setError(null);
    }, [selectedYear, availableMonths]);

    useEffect(() => {
        if (activeView === 'reports' && selectedYear && selectedMonth) {
            const reportId = `${selectedYear}-${String(parseInt(selectedMonth) + 1).padStart(2, '0')}`;
            const existingReport = reports.find(r => r.id === reportId);
            setReportData(existingReport || null);
            setError(null);
        } else {
            setReportData(null);
        }
    }, [activeView, selectedYear, selectedMonth, reports]);

    const combinedTransactions = useMemo((): DisplayTransaction[] => {
        if (!selectedYear || !selectedMonth) return [];

        const year = parseInt(selectedYear);
        const month = parseInt(selectedMonth);

        const getAccount = (id?: string) => accounts.find(a => a.id === id);

        const filteredTransactions = transactions
            .filter(transaction => { const d = new Date(transaction.date); return d.getUTCFullYear() === year && d.getUTCMonth() === month; })
            .map((transaction): DisplayTransaction => {
                const account = getAccount(transaction.accountId || transaction.fromAccountId);
                const currencySymbol = account ? getCurrencySymbol(account.currency) : '€';
                
                if (transaction.type === TransactionType.TRANSFER) {
                    const toAccount = getAccount(transaction.toAccountId);
                    return {
                        id: transaction.id, date: transaction.date, description: transaction.description, amount: transaction.amount,
                        isPositive: false, // Neutral, but display style needs a boolean
                        currencySymbol: currencySymbol, accountName: account?.name || 'N/A',
                        details: `To: ${toAccount?.name || 'N/A'}`,
                        Icon: SwitchHorizontalIcon, color: 'text-blue-400'
                    }
                }
                 if (transaction.type === TransactionType.INCOME) {
                    return {
                        id: transaction.id, date: transaction.date, description: transaction.description, amount: transaction.amount, isPositive: true,
                        currencySymbol: currencySymbol, accountName: account?.name || 'N/A', details: transaction.incomeType || '',
                        Icon: ArrowUpIcon, color: 'text-green-400'
                    }
                }
                // COST
                return {
                    id: transaction.id, date: transaction.date, description: transaction.description, amount: transaction.amount, isPositive: false,
                    currencySymbol: currencySymbol, accountName: account?.name || 'N/A', details: `${transaction.category} > ${transaction.subCategory}`,
                    Icon: ArrowDownIcon, color: 'text-red-400'
                }
            });

        const filteredInvestmentTransactions = investmentTransactions
            .filter(transaction => { const d = new Date(transaction.date); return d.getUTCFullYear() === year && d.getUTCMonth() === month; })
            .map((transaction): DisplayTransaction | null => {
                const account = getAccount(transaction.accountId);
                const holding = investmentHoldings.find(h => h.id === transaction.holdingId);
                if (!account || !holding) return null;

                const currencySymbol = getCurrencySymbol(account.currency);
                const isPositive = transaction.type === InvestmentTransactionType.SELL || transaction.type === InvestmentTransactionType.DIVIDEND;

                return {
                    id: transaction.id, date: transaction.date, amount: transaction.totalAmount, isPositive, currencySymbol,
                    accountName: account.name,
                    description: `${t(`investmentTransactionTypes.${transaction.type}`)} ${holding.ticker}`,
                    details: transaction.type !== 'DIVIDEND' ? `${transaction.quantity.toFixed(4)} @ ${transaction.pricePerUnit.toFixed(2)}` : 'Dividend Income',
                    Icon: isPositive ? ArrowUpIcon : ArrowDownIcon,
                    color: transaction.type === 'BUY' ? 'text-red-400' : 'text-green-400'
                }
            }).filter((transaction): transaction is DisplayTransaction => transaction !== null);

        return [...filteredTransactions, ...filteredInvestmentTransactions]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    }, [selectedYear, selectedMonth, transactions, investmentTransactions, accounts, investmentHoldings, getCurrencySymbol, t]);

    const getMonthName = (monthIndex: number): string => {
        return t(`months.${monthIndex}`);
    };

    const handleGenerateReport = async () => {
        if (!selectedYear || !selectedMonth) {
            setReportData(null);
            return;
        }

        setIsLoading(true);
        setError(null);

        const priceCache = new Map<string, number>();
        const cryptoMap = new Map(CRYPTOCURRENCIES.map(c => [c.ticker, c.coingeckoId]));

        const getHistoricalPrice = async (holding: InvestmentHolding, date: Date): Promise<number> => {
            const cacheKey = `${holding.ticker}-${date.toISOString().split('T')[0]}`;
            if (priceCache.has(cacheKey)) return priceCache.get(cacheKey)!;
            
            try {
                let price = 0;
                if (holding.investmentType === 'Crypto') {
                    const coingeckoId = cryptoMap.get(holding.ticker);
                    if (!coingeckoId) throw new Error('Crypto not found');
                    const dateStr = `${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}`;
                    const cryptoUrl = `https://api.coingecko.com/api/v3/coins/${coingeckoId}/history?date=${dateStr}`;
                    const res = await fetch(cryptoUrl);
                    const data = await res.json();
                    price = data?.market_data?.current_price?.[holding.currency.toLowerCase()] ?? 0;
                } else { // Stock or ETF
                    const period1 = Math.floor(date.getTime() / 1000);
                    const period2 = period1 + 86400; // 24 hours later
                    const stockUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${holding.ticker}?period1=${period1}&period2=${period2}&interval=1d`;
                    const res = await fetch(stockUrl);
                    const data = await res.json();
                    price = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close?.[0] ?? 0;
                }
                if (price > 0) {
                    priceCache.set(cacheKey, price);
                    return price;
                }
                throw new Error('Price not found');
            } catch (error) {
                console.warn(`Could not fetch price for ${holding.ticker} on ${date.toLocaleDateString()}:`, error);
                 const transactionsBeforeDate = investmentTransactions
                    .filter(t => t.holdingId === holding.id && new Date(t.date) <= date && (t.type === 'BUY' || t.type === 'SELL'))
                    .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                
                const fallbackPrice = transactionsBeforeDate.length > 0 ? transactionsBeforeDate[0].pricePerUnit : 0;
                priceCache.set(cacheKey, fallbackPrice);
                return fallbackPrice;
            }
        };

        try {
            const year = parseInt(selectedYear);
            const month = parseInt(selectedMonth);
            const reportId = `${year}-${String(month + 1).padStart(2, '0')}`;
            
            const getPortfolioValueAtDate = async (evalDate: Date, types?: InvestmentType[]): Promise<number> => {
                let totalValueEUR = 0;
                const relevantHoldings = types ? investmentHoldings.filter(h => types.includes(h.investmentType)) : investmentHoldings;
    
                for (const holding of relevantHoldings) {
                    const transactionsUpToDate = investmentTransactions.filter(t => t.holdingId === holding.id && new Date(t.date) <= evalDate);
                    if (transactionsUpToDate.length === 0) continue;
    
                    const quantityAtDate = transactionsUpToDate.reduce((sum, t) => {
                        if (t.type === InvestmentTransactionType.BUY) return sum + t.quantity;
                        if (t.type === InvestmentTransactionType.SELL) return sum - t.quantity;
                        return sum;
                    }, 0);
                    if (quantityAtDate <= 0) continue;
    
                    const price = await getHistoricalPrice(holding, evalDate);
                    const marketValue = quantityAtDate * price;
                    totalValueEUR += convertCurrency(marketValue, holding.currency, Currency.EUR);
                }
                return totalValueEUR;
            };

            const reportStartDate = new Date(Date.UTC(year, month, 1));
            const reportEndDate = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

            const getAccountCurrency = (accountId: string): Currency => accounts.find(a => a.id === accountId)?.currency || Currency.EUR;

            const monthTransactions = transactions.filter(t => { const d = new Date(t.date); return d >= reportStartDate && d <= reportEndDate; });
            const monthInvestmentTransactions = investmentTransactions.filter(t => { const d = new Date(t.date); return d >= reportStartDate && d <= reportEndDate; });

            const workIncome = monthTransactions.filter(t => t.incomeType === 'Work').reduce((s, t) => s + convertCurrency(t.amount, getAccountCurrency(t.accountId!), Currency.EUR), 0);
            const extraIncome = monthTransactions.filter(t => t.incomeType === 'Extra');
            const dividends = monthInvestmentTransactions.filter(t => t.type === InvestmentTransactionType.DIVIDEND);
            const totalIncome = workIncome + extraIncome.reduce((s, t) => s + convertCurrency(t.amount, getAccountCurrency(t.accountId!), Currency.EUR), 0) + dividends.reduce((s, t) => s + convertCurrency(t.totalAmount, getAccountCurrency(t.accountId!), Currency.EUR), 0);
            
            const mustSpending = monthTransactions.filter(t => t.category === CostCategory.MUST).reduce((s, t) => s + convertCurrency(t.amount, getAccountCurrency(t.accountId!), Currency.EUR), 0);
            const wantsSpending = monthTransactions.filter(t => t.category === CostCategory.WANTS).reduce((s, t) => s + convertCurrency(t.amount, getAccountCurrency(t.accountId!), Currency.EUR), 0);
            const totalSpending = mustSpending + wantsSpending;
            
            const buys = monthInvestmentTransactions.filter(t => t.type === InvestmentTransactionType.BUY);
            const sells = monthInvestmentTransactions.filter(t => t.type === InvestmentTransactionType.SELL);
            const totalBuys = buys.reduce((s, t) => s + convertCurrency(t.totalAmount, getAccountCurrency(t.accountId!), Currency.EUR), 0);
            const totalSells = sells.reduce((s, t) => s + convertCurrency(t.totalAmount, getAccountCurrency(t.accountId!), Currency.EUR), 0);

            const netSavings = totalIncome - totalSpending;
            const netInvestments = totalBuys - totalSells;
            const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;
            const investmentRate = totalIncome > 0 ? (netInvestments / totalIncome) * 100 : 0;
            const cashFlow = totalIncome - totalSpending - netInvestments;

            const bySubCategory: { [key: string]: { total: number, category: CostCategory } } = {};
            monthTransactions.filter(t => t.type === TransactionType.COST && t.subCategory && t.category).forEach(t => {
                const subCat = t.subCategory!;
                if (!bySubCategory[subCat]) bySubCategory[subCat] = { total: 0, category: t.category! };
                bySubCategory[subCat].total += convertCurrency(t.amount, getAccountCurrency(t.accountId!), Currency.EUR);
            });
            
            const summaryForMonth = monthlySummaries.find(s => s.id === reportId);
            const endOfMonthCash = summaryForMonth ? summaryForMonth.endOfMonthCash : 0;

            const portfolioStartDate = new Date(Date.UTC(year, month, 0)); // Last day of previous month
            const portfolioEndDate = new Date(Date.UTC(year, month + 1, 0)); // Last day of selected month
            
            const [
                endValueTotal, startValueTotal,
                endValueStocks, startValueStocks,
                endValueEtfs, startValueEtfs,
                endValueCrypto, startValueCrypto
            ] = await Promise.all([
                getPortfolioValueAtDate(portfolioEndDate), getPortfolioValueAtDate(portfolioStartDate),
                getPortfolioValueAtDate(portfolioEndDate, ['Stock']), getPortfolioValueAtDate(portfolioStartDate, ['Stock']),
                getPortfolioValueAtDate(portfolioEndDate, ['ETF']), getPortfolioValueAtDate(portfolioStartDate, ['ETF']),
                getPortfolioValueAtDate(portfolioEndDate, ['Crypto']), getPortfolioValueAtDate(portfolioStartDate, ['Crypto'])
            ]);
            const endOfMonthInvestments = endValueTotal;


            const getNetInflowsForTypes = (types?: InvestmentType[]) => {
                const ids = types ? investmentHoldings.filter(h => types.includes(h.investmentType)).map(h => h.id) : investmentHoldings.map(h => h.id);
                const buysAmt = monthInvestmentTransactions.filter(t => t.type === 'BUY' && ids.includes(t.holdingId)).reduce((s, t) => s + convertCurrency(t.totalAmount, getAccountCurrency(t.accountId!), Currency.EUR), 0);
                const sellsAmt = monthInvestmentTransactions.filter(t => t.type === 'SELL' && ids.includes(t.holdingId)).reduce((s, t) => s + convertCurrency(t.totalAmount, getAccountCurrency(t.accountId!), Currency.EUR), 0);
                return buysAmt - sellsAmt;
            };

            const netInflowsTotal = getNetInflowsForTypes();
            const netInflowsStocks = getNetInflowsForTypes(['Stock']);
            const netInflowsEtfs = getNetInflowsForTypes(['ETF']);
            const netInflowsCrypto = getNetInflowsForTypes(['Crypto']);

            const calculatePerformance = (end: number, start: number, inflows: number) => {
                const gain = end - start - inflows;
                const denominator = start + (inflows * 0.5); // Modified Dietz method
                return denominator > 1 ? (gain / denominator) * 100 : 0;
            };
            
            const performanceTotal = calculatePerformance(endValueTotal, startValueTotal, netInflowsTotal);
            const performanceStocks = calculatePerformance(endValueStocks, startValueStocks, netInflowsStocks);
            const performanceEtfs = calculatePerformance(endValueEtfs, startValueEtfs, netInflowsEtfs);
            const performanceCrypto = calculatePerformance(endValueCrypto, startValueCrypto, netInflowsCrypto);
           
            const newReportData: ReportData = {
                id: reportId,
                year, month,
                summary: { totalIncome, totalSpending, netSavings, netInvestments, savingsRate, investmentRate, cashFlow, endOfMonthCash, endOfMonthInvestments, endOfMonthInvestmentsStocks: endValueStocks, endOfMonthInvestmentsEtfs: endValueEtfs, endOfMonthInvestmentsCrypto: endValueCrypto },
                incomeDetails: { workIncome, extraIncome, dividends },
                expenseDetails: { mustSpending, wantsSpending, transactions: monthTransactions.filter(t => t.type === TransactionType.COST), bySubCategory },
                investmentDetails: { buys, sells, performance: { total: performanceTotal, stocks: performanceStocks, etfs: performanceEtfs, crypto: performanceCrypto }, startValue: startValueTotal, endValue: endValueTotal, netInflows: netInflowsTotal }
            };

            saveReport(newReportData);

        } catch (e) {
            console.error("Failed to generate report:", e);
            setError(t('history.errorMessage'));
        } finally {
            setIsLoading(false);
        }
    };
    
    const downloadCSV = (csvContent: string, filename: string) => {
        const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' }); // Add BOM for Excel
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    const exportTransactionsToCSV = (transactionsToExport: DisplayTransaction[]) => {
        const headers = ['Date', 'Description', 'Amount', 'Currency', 'Account Name', 'Details'];
        const csvRows = [headers.join(',')];
      
        for (const tx of transactionsToExport) {
            const amount = tx.isPositive ? tx.amount : -tx.amount;
            const values = [
                tx.date,
                `"${tx.description.replace(/"/g, '""')}"`,
                amount.toFixed(2),
                tx.currencySymbol === '€' ? 'EUR' : 'USD',
                `"${tx.accountName.replace(/"/g, '""')}"`,
                `"${tx.details.replace(/"/g, '""')}"`,
            ];
            csvRows.push(values.join(','));
        }
      
        downloadCSV(csvRows.join('\n'), `transactions-${selectedYear}-${String(parseInt(selectedMonth) + 1).padStart(2, '0')}.csv`);
    };

    const exportReportToCSV = (data: ReportData) => {
        const { summary, incomeDetails, expenseDetails, investmentDetails, year, month } = data;
        let csvContent = '';
        
        const addRow = (section: string, item: string, value: string | number) => {
            const formattedValue = typeof value === 'number' ? value.toFixed(2).replace('.', ',') : `"${String(value).replace(/"/g, '""')}"`;
            csvContent += `"${section}";"${item}";${formattedValue}\n`;
        };
      
        csvContent += 'Section;Item;Value\n';
        
        addRow('Summary', 'Total Income', summary.totalIncome);
        addRow('Summary', 'Total Expenses', summary.totalSpending);
        addRow('Summary', 'Net Savings', summary.netSavings);
        addRow('Summary', 'Cash Flow', summary.cashFlow);
        addRow('Summary', 'End of Month Cash', summary.endOfMonthCash);
        addRow('Summary', 'End of Month Investments', summary.endOfMonthInvestments);
        addRow('Summary', 'Savings Rate (%)', summary.savingsRate);
        addRow('Summary', 'Investment Rate (%)', summary.investmentRate);
        csvContent += '\n';
      
        addRow('Income', 'Work Income', incomeDetails.workIncome);
        incomeDetails.dividends.forEach((tx) => {
            const holding = investmentHoldings.find(h => h.id === tx.holdingId);
            addRow('Income', `Dividend (${holding?.ticker})`, tx.totalAmount);
        });
        incomeDetails.extraIncome.forEach((tx) => addRow('Income', `Extra (${tx.description})`, tx.amount));
        csvContent += '\n';
      
        addRow('Expenses', 'Musts', expenseDetails.mustSpending);
        addRow('Expenses', 'Wants', expenseDetails.wantsSpending);
        csvContent += '\n';
        Object.entries(expenseDetails.bySubCategory).forEach(([name, catData]) => {
            addRow('Expense Category', name, catData.total);
        });
        csvContent += '\n';
        
        addRow('Investments', 'Start Value', investmentDetails.startValue);
        addRow('Investments', 'End Value', investmentDetails.endValue);
        addRow('Investments', 'Net Inflows', investmentDetails.netInflows);
        addRow('Investments', 'Total Performance (%)', investmentDetails.performance.total);
        addRow('Investments', 'Stocks Performance (%)', investmentDetails.performance.stocks);
        addRow('Investments', 'ETFs Performance (%)', investmentDetails.performance.etfs);
        addRow('Investments', 'Crypto Performance (%)', investmentDetails.performance.crypto);
      
        downloadCSV(csvContent, `report-${year}-${String(month + 1).padStart(2, '0')}.csv`);
    };

    const handleExport = () => {
        if (activeView === 'transactions' && combinedTransactions.length > 0) {
          exportTransactionsToCSV(combinedTransactions);
        } else if (activeView === 'reports' && reportData) {
          exportReportToCSV(reportData);
        }
    };

    const isExportDisabled = (activeView === 'reports' && !reportData) || (activeView === 'transactions' && combinedTransactions.length === 0);
    const inputClasses = "w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all";

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <h2 className="text-xl font-bold text-center text-gray-100">{t('history.title')}</h2>

            <div className="flex bg-gray-700 p-1 rounded-lg">
                <button type="button" onClick={() => setActiveView('reports')} className={`w-1/2 py-2 rounded-md text-sm font-semibold transition-colors ${activeView === 'reports' ? 'bg-indigo-600 text-white' : 'text-gray-300'}`}>{t('history.monthlyReports')}</button>
                <button type="button" onClick={() => setActiveView('transactions')} className={`w-1/2 py-2 rounded-md text-sm font-semibold transition-colors ${activeView === 'transactions' ? 'bg-indigo-600 text-white' : 'text-gray-300'}`}>{t('history.transactionHistory')}</button>
            </div>
            
            <div className="bg-gray-800 p-4 rounded-lg shadow-md flex flex-col sm:flex-row items-center gap-4">
                <div className="w-full sm:w-1/3">
                    <label htmlFor="year-select" className="text-sm font-medium text-gray-300 mb-1 block">{t('history.year')}</label>
                    <select id="year-select" value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className={inputClasses}>
                        {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
                <div className="w-full sm:w-1/3">
                     <label htmlFor="month-select" className="text-sm font-medium text-gray-300 mb-1 block">{t('history.month')}</label>
                    <select id="month-select" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className={inputClasses} disabled={!selectedYear}>
                        {availableMonths.map(m => <option key={m} value={m}>{getMonthName(m)}</option>)}
                    </select>
                </div>
                <div className="w-full sm:w-1/3 sm:pt-6 flex items-center space-x-2">
                    {activeView === 'reports' && (
                        <button onClick={handleGenerateReport} disabled={!selectedYear || !selectedMonth || isLoading} className="w-full bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center justify-center space-x-2">
                            {isLoading && <SpinnerIcon className="animate-spin h-5 w-5" />}
                            <span>{isLoading ? t('history.generating') : (reportData ? t('history.refreshReport') : t('history.generateReport'))}</span>
                        </button>
                    )}
                    <button onClick={handleExport} disabled={isExportDisabled} className="w-full bg-teal-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-teal-700 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center justify-center space-x-2">
                        <ArrowDownTrayIcon className="h-5 w-5" />
                        <span>{t('history.exportToCsv')}</span>
                    </button>
                </div>
            </div>

            {activeView === 'reports' && (
                <>
                    {error && (
                        <div className="bg-red-900/20 border border-red-500/50 p-4 rounded-lg text-center">
                            <p className="font-bold text-red-300">{t('history.errorTitle')}</p>
                            <p className="text-sm text-red-400">{error}</p>
                        </div>
                    )}

                    {reportData ? (
                        <MonthlyReport data={reportData} />
                    ) : !isLoading && (
                        <div className="bg-gray-800 text-center p-8 rounded-lg">
                            <p className="text-gray-400">{t('history.prompt')}</p>
                        </div>
                    )}
                </>
            )}

            {activeView === 'transactions' && (
                <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                    <h4 className="text-lg font-semibold text-gray-200 mb-4">
                      {selectedYear && selectedMonth ? t('history.transactionsFor', { month: getMonthName(parseInt(selectedMonth)), year: selectedYear}) : ''}
                    </h4>
                    {combinedTransactions.length > 0 ? (
                         <ul className="space-y-3">
                           {combinedTransactions.map(tx => <TransactionRow key={tx.id} transaction={tx} />)}
                         </ul>
                    ) : (
                         <p className="text-gray-400 text-center py-4">{t('history.noTransactionsForPeriod')}</p>
                    )}
                </div>
            )}

        </div>
    );
};

export default History;
