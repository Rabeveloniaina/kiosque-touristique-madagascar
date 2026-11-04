import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight, Banknote, Coins, Delete, DollarSign, Euro,
  Info, RefreshCw, TrendingUp, WifiOff
} from 'lucide-react';
import { translations } from '../../data/translations';

// Indicative market rates used when the kiosk is offline:
// 1 EUR = 5 000 MGA and 1 USD = 4 600 MGA.
const DEFAULT_RATES = { EUR: 5000, USD: 4600 };
const RATES_STORAGE_KEY = 'kiosk_exchange_rates';
const RATES_API_URL = 'https://open.er-api.com/v6/latest/EUR';
const CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000;

const CURRENCIES = ['MGA', 'EUR', 'USD'];

const CURRENCY_META = {
  MGA: {
    symbol: 'Ar',
    icon: Banknote,
    text: 'text-amber-400',
    bg: 'bg-amber-500/15',
    border: 'border-amber-500/40',
    active: 'bg-amber-500 text-slate-950 border-amber-400',
    glow: 'hover:border-amber-400/70',
  },
  EUR: {
    symbol: '€',
    icon: Euro,
    text: 'text-indigo-400',
    bg: 'bg-indigo-500/15',
    border: 'border-indigo-500/40',
    active: 'bg-indigo-500 text-white border-indigo-400',
    glow: 'hover:border-indigo-400/70',
  },
  USD: {
    symbol: '$',
    icon: DollarSign,
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/15',
    border: 'border-emerald-500/40',
    active: 'bg-emerald-500 text-white border-emerald-400',
    glow: 'hover:border-emerald-400/70',
  },
};

const QUICK_AMOUNTS = {
  MGA: [1000, 5000, 10000, 20000, 50000, 100000],
  EUR: [5, 10, 20, 50, 100, 200],
  USD: [5, 10, 20, 50, 100, 200],
};

function loadCachedRates() {
  try {
    const raw = localStorage.getItem(RATES_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Number.isFinite(parsed?.rates?.EUR) || parsed.rates.EUR <= 0) return null;
    if (!Number.isFinite(parsed?.rates?.USD) || parsed.rates.USD <= 0) return null;
    if (!Number.isFinite(parsed?.updatedAt)) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function fetchMarketRates(signal) {
  const res = await fetch(RATES_API_URL, { signal, cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json();
  const mgaPerEur = Number(data?.rates?.MGA);
  const eurPerUsd = Number(data?.rates?.USD);

  if (data?.result !== 'success' || !Number.isFinite(mgaPerEur) || !Number.isFinite(eurPerUsd) || eurPerUsd <= 0) {
    throw new Error('Taux indisponibles');
  }

  return {
    rates: {
      EUR: mgaPerEur,
      USD: mgaPerEur / eurPerUsd,
    },
    updatedAt: Date.now(),
  };
}

function formatNumber(value, lang, currency) {
  if (!Number.isFinite(value)) return '0';
  const locale = lang === 'en' ? 'en-US' : 'fr-FR';
  const isSmall = currency !== 'MGA' && value > 0 && value < 1;
  const fractionDigits = currency === 'MGA' ? 0 : isSmall ? 3 : 2;

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

function formatRate(value, lang) {
  if (!Number.isFinite(value)) return '0';
  return new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'fr-FR', {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatInputAmount(raw, lang) {
  if (!raw) return '0';
  const separator = lang === 'en' ? '.' : ',';
  const [integerPart, decimalPart] = raw.split('.');
  const grouped = new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'fr-FR', {
    maximumFractionDigits: 0,
  }).format(Number(integerPart || '0'));

  return decimalPart !== undefined ? `${grouped}${separator}${decimalPart}` : grouped;
}

export default function ConverterModuleView({ currentLang, onLogItemClick }) {
  const t = translations[currentLang] || translations.fr;
  const labels = t.converter;

  const [rateState, setRateState] = useState(() => {
    const cached = loadCachedRates();
    if (cached) {
      return { rates: cached.rates, updatedAt: cached.updatedAt, source: 'cache' };
    }
    return { rates: DEFAULT_RATES, updatedAt: null, source: 'default' };
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const [fromCurrency, setFromCurrency] = useState('MGA');
  const [amount, setAmount] = useState('10000');

  const { rates, updatedAt, source } = rateState;
  const didAutoRefresh = useRef(false);

  const refreshRates = useCallback(async ({ silent = false } = {}) => {
    setIsRefreshing(true);
    if (!silent) setRefreshError(false);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const fresh = await fetchMarketRates(controller.signal);
      setRateState({ rates: fresh.rates, updatedAt: fresh.updatedAt, source: 'live' });
      setRefreshError(false);
      try {
        localStorage.setItem(
          RATES_STORAGE_KEY,
          JSON.stringify({ rates: fresh.rates, updatedAt: fresh.updatedAt })
        );
      } catch {
        // Storage may be unavailable (private mode / full disk): live rates still work.
      }
    } catch {
      setRefreshError(true);
      // Keep the cached rates (or the indicative defaults) when the network is unavailable.
    } finally {
      clearTimeout(timeoutId);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (didAutoRefresh.current) return;
    didAutoRefresh.current = true;

    const cached = loadCachedRates();
    const cacheIsFresh = cached && Date.now() - cached.updatedAt < CACHE_MAX_AGE_MS;
    if (!cacheIsFresh) refreshRates({ silent: true });
  }, [refreshRates]);

  const decimalSeparator = currentLang === 'en' ? '.' : ',';
  const displayAmount = formatInputAmount(amount, currentLang);

  const numericAmount = Number.parseFloat(amount || '0') || 0;

  const convert = useCallback(
    (value, from, to) => {
      if (from === to) return value;
      const valueInMga = from === 'MGA' ? value : value * rates[from];
      return to === 'MGA' ? valueInMga : valueInMga / rates[to];
    },
    [rates]
  );

  const results = useMemo(
    () =>
      CURRENCIES.filter((currency) => currency !== fromCurrency).map((currency) => ({
        currency,
        value: convert(numericAmount, fromCurrency, currency),
      })),
    [convert, fromCurrency, numericAmount]
  );

  const handleKey = (key) => {
    if (key === 'clear') {
      setAmount('');
      return;
    }

    if (key === 'backspace') {
      setAmount((prev) => prev.slice(0, -1));
      return;
    }

    if (key === decimalSeparator) {
      if (fromCurrency === 'MGA') return;
      setAmount((prev) => {
        if (prev.includes('.')) return prev;
        return `${prev || '0'}.`;
      });
      return;
    }

    setAmount((prev) => {
      const candidate = (prev === '' ? key : prev + key).replace(/^0+(?=\d)/, '');
      const [integerPart, decimalPart] = candidate.split('.');
      if (integerPart.length > 9) return prev;
      if (decimalPart !== undefined && decimalPart.length > 2) return prev;
      return candidate;
    });
  };

  const handleCurrencyChange = (currency) => {
    if (currency === fromCurrency) return;
    setFromCurrency(currency);
    if (currency === 'MGA') {
      setAmount((prev) => prev.split('.')[0]);
    }
    onLogItemClick?.('CONVERTER', currency);
  };

  const handleQuickAmount = (value) => {
    setAmount(String(value));
  };

  const status = (() => {
    if (isRefreshing) {
      return {
        label: labels.refreshing,
        dot: 'bg-sky-400 animate-pulse',
        box: 'bg-sky-950/60 border-sky-500/30 text-sky-300',
        icon: RefreshCw,
      };
    }
    if (refreshError) {
      return {
        label: source === 'default' ? labels.offlineDefault : labels.offline,
        dot: 'bg-amber-400',
        box: 'bg-amber-950/60 border-amber-500/30 text-amber-300',
        icon: WifiOff,
      };
    }
    if (source === 'live') {
      return {
        label: labels.live,
        dot: 'bg-emerald-400 animate-pulse',
        box: 'bg-emerald-950/60 border-emerald-500/30 text-emerald-300',
        icon: null,
      };
    }
    if (source === 'cache') {
      return {
        label: labels.cached,
        dot: 'bg-amber-400',
        box: 'bg-amber-950/60 border-amber-500/30 text-amber-300',
        icon: null,
      };
    }
    return {
      label: labels.fallback,
      dot: 'bg-slate-500',
      box: 'bg-slate-900 border-slate-700 text-slate-300',
      icon: null,
    };
  })();

  const StatusIcon = status.icon;
  const timeLabel = updatedAt
    ? new Date(updatedAt).toLocaleTimeString(currentLang === 'en' ? 'en-US' : 'fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const keypadRows = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    [fromCurrency === 'MGA' ? '000' : decimalSeparator, '0', '00'],
  ];

  return (
    <div className="flex-1 w-full bg-slate-950 flex flex-col overflow-y-auto">
      <div className="max-w-6xl mx-auto w-full px-6 py-6 md:py-8 pb-24 md:pb-28">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-gradient-to-br from-cyan-600 to-blue-700 rounded-2xl shadow-lg shadow-cyan-500/20">
              <Coins className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-white flex items-center space-x-2">
                <span>{labels.title}</span>
                <ArrowLeftRight className="w-5 h-5 text-cyan-400 hidden sm:block" />
              </h1>
              <p className="text-slate-400 text-xs md:text-sm mt-0.5">{labels.subtitle}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className={`flex items-center space-x-2 px-3.5 py-2 rounded-2xl border text-xs font-bold ${status.box}`}>
              {StatusIcon ? (
                <StatusIcon className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              ) : (
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${status.dot}`} />
              )}
              <span>{status.label}</span>
              {timeLabel && <span className="text-slate-500 font-medium">· {timeLabel}</span>}
            </div>

            <button
              type="button"
              onClick={() => refreshRates()}
              disabled={isRefreshing}
              className="flex items-center space-x-2 px-4 py-2 rounded-2xl bg-slate-900 border-2 border-slate-700 hover:border-cyan-400/60 text-slate-300 hover:text-white text-xs font-bold transition active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
              title={labels.refresh}
            >
              <RefreshCw className={`w-4 h-4 text-cyan-400 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{labels.refresh}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: amount + keypad */}
          <div className="lg:col-span-7 bg-slate-900/90 border-2 border-slate-800 rounded-3xl p-5 md:p-6 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                {labels.fromLabel}
              </span>
              <span className="text-[11px] text-slate-600 font-medium">{labels.keypadHint}</span>
            </div>

            {/* Currency selector */}
            <div className="grid grid-cols-3 gap-2 mb-5">
              {CURRENCIES.map((currency) => {
                const meta = CURRENCY_META[currency];
                const Icon = meta.icon;
                const isActive = fromCurrency === currency;
                return (
                  <button
                    key={currency}
                    type="button"
                    onClick={() => handleCurrencyChange(currency)}
                    className={`flex items-center justify-center space-x-2 py-3 rounded-2xl border-2 font-black transition active:scale-95 ${
                      isActive
                        ? meta.active
                        : `bg-slate-950 border-slate-700 text-slate-300 ${meta.glow}`
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-sm">{currency}</span>
                  </button>
                );
              })}
            </div>

            {/* Amount display */}
            <div className="bg-slate-950 border-2 border-cyan-500/30 rounded-3xl px-5 py-4 mb-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                {labels.amountLabel}
              </span>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-4xl md:text-5xl font-black text-white tabular-nums tracking-tight break-all">
                  {displayAmount}
                </span>
                <span className={`text-xl md:text-2xl font-black flex-shrink-0 ${CURRENCY_META[fromCurrency].text}`}>
                  {CURRENCY_META[fromCurrency].symbol}
                </span>
              </div>
            </div>

            {/* Quick amounts */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 mr-1">
                {labels.quickAmounts}
              </span>
              {QUICK_AMOUNTS[fromCurrency].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleQuickAmount(value)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-cyan-400/50 text-slate-200 text-xs font-bold transition active:scale-95"
                >
                  {formatRate(value, currentLang)} {CURRENCY_META[fromCurrency].symbol}
                </button>
              ))}
            </div>

            {/* Keypad */}
            <div className="flex gap-2.5">
              <div className="grid grid-cols-3 gap-2.5 flex-1">
                {keypadRows.flat().map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleKey(key)}
                    className="py-4 md:py-5 rounded-2xl bg-slate-950 border-2 border-slate-800 hover:border-cyan-400/50 hover:bg-slate-800 text-white text-2xl font-black transition active:scale-95 touch-manipulation"
                  >
                    {key}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-2.5 w-20 md:w-24">
                <button
                  type="button"
                  onClick={() => handleKey('clear')}
                  className="flex-1 rounded-2xl bg-rose-950/60 border-2 border-rose-500/40 hover:bg-rose-900/70 text-rose-300 text-sm font-black uppercase transition active:scale-95 touch-manipulation"
                >
                  {labels.clear}
                </button>
                <button
                  type="button"
                  onClick={() => handleKey('backspace')}
                  className="flex-1 rounded-2xl bg-slate-950 border-2 border-slate-800 hover:border-amber-400/50 text-amber-300 flex items-center justify-center transition active:scale-95 touch-manipulation"
                  aria-label={labels.backspace}
                  title={labels.backspace}
                >
                  <Delete className="w-7 h-7" />
                </button>
              </div>
            </div>
          </div>

          {/* Right: conversion results + market rates */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            <div className="bg-slate-900/90 border-2 border-slate-800 rounded-3xl p-5 md:p-6 shadow-xl">
              <div className="flex items-center space-x-2 mb-4">
                <TrendingUp className="w-5 h-5 text-cyan-400" />
                <h2 className="text-sm font-black uppercase tracking-wider text-slate-300">
                  {labels.resultsTitle}
                </h2>
              </div>

              <div className="space-y-3">
                {results.map(({ currency, value }) => {
                  const meta = CURRENCY_META[currency];
                  const Icon = meta.icon;
                  return (
                    <div
                      key={currency}
                      className={`bg-slate-950 border-2 ${meta.border} rounded-2xl p-4`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <div className={`p-1.5 rounded-lg ${meta.bg}`}>
                            <Icon className={`w-4 h-4 ${meta.text}`} />
                          </div>
                          <span className="text-xs font-bold text-slate-400">
                            {labels.equivalent} {labels.currencies[currency]}
                          </span>
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-wider ${meta.text}`}>
                          {currency}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-3xl md:text-4xl font-black text-white tabular-nums tracking-tight break-all">
                          {formatNumber(value, currentLang, currency)}
                        </span>
                        <span className={`text-xl font-black flex-shrink-0 ${meta.text}`}>
                          {meta.symbol}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-600 font-medium mt-1">
                        1 {currency === 'MGA' ? fromCurrency : currency} ={' '}
                        {formatRate(currency === 'MGA' ? rates[fromCurrency] : rates[currency], currentLang)} Ar
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-slate-900/90 border-2 border-slate-800 rounded-3xl p-5 md:p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-black uppercase tracking-wider text-slate-300 flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5 text-amber-400" />
                  <span>{labels.ratesTitle}</span>
                </h2>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {labels.market}
                </span>
              </div>

              <div className="space-y-2.5">
                {['EUR', 'USD'].map((currency) => {
                  const meta = CURRENCY_META[currency];
                  const Icon = meta.icon;
                  return (
                    <div
                      key={currency}
                      className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5"
                    >
                      <div className="flex items-center space-x-2">
                        <Icon className={`w-4 h-4 ${meta.text}`} />
                        <span className="text-xs font-bold text-slate-300">1 {currency}</span>
                      </div>
                      <span className="text-sm font-black text-white tabular-nums">
                        {formatRate(rates[currency], currentLang)}{' '}
                        <span className="text-amber-400 text-xs">Ar</span>
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-start space-x-2 mt-4 pt-3 border-t border-slate-800">
                <Info className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {labels.disclaimer}
                  {source === 'live' && (
                    <span className="block text-slate-600 mt-0.5">{labels.source}</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
