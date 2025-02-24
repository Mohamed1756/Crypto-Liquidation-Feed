import { useEffect, useState } from 'react';

interface BybitSymbol {
  symbol: string;
  category: string;
}

export const useBybitSymbols = () => {
  const [symbols, setSymbols] = useState<string[]>([]);

  useEffect(() => {
    const fetchSymbols = async () => {
      try {
        // Fetch linear USDT perpetual symbols
        const response = await fetch('https://api.bybit.com/v5/market/instruments-info?category=linear');
        const data = await response.json();
        
        if (data.retCode === 0) {
          const perpetualSymbols = data.result.list
            .filter((item: BybitSymbol) => item.symbol.endsWith('USDT'))
            .map((item: BybitSymbol) => item.symbol);
          
          setSymbols(perpetualSymbols);
        }
      } catch (error) {
        console.error('Failed to fetch Bybit symbols:', error);
      }
    };

    fetchSymbols();
  }, []);

  return symbols;
};