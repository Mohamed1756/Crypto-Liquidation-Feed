import React, { useEffect, useMemo, useRef } from 'react';
import { Box, HStack, Text, VStack } from '@chakra-ui/react';
import { InlineHelp } from './InlineHelp';
import { useLiquidationStore } from '../store/liquidationStore';
import type { Liquidation } from '../types/liquidation';

const TIME_WINDOW_MS = 120000;

const getTimestampMs = (liquidation: Liquidation) => liquidation.timestamp.toMillis();

const formatTime = (liquidation: Liquidation | null) => {
  if (!liquidation) {
    return 'No recent print';
  }

  return liquidation.timestamp.toFormat('HH:mm:ss');
};

export const ParticleHeatmap = React.memo(({ liquidations: incomingLiquidations }: { liquidations?: Liquidation[] }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const liveLiquidations = useLiquidationStore((state) => state.liquidations);
  const liquidations = incomingLiquidations ?? liveLiquidations;
  const latestLiquidation = useMemo(() => {
    if (liquidations.length === 0) {
      return null;
    }

    return liquidations.reduce((latest, current) => (
      getTimestampMs(current) > getTimestampMs(latest) ? current : latest
    ));
  }, [liquidations]);
  const referenceNowMs = latestLiquidation ? getTimestampMs(latestLiquidation) : Date.now();
  const recentLiquidations = useMemo(() => {
    const cutoff = referenceNowMs - TIME_WINDOW_MS;
    return liquidations.filter((liquidation) => {
      const timestampMs = getTimestampMs(liquidation);
      return timestampMs >= cutoff && timestampMs <= referenceNowMs;
    });
  }, [liquidations, referenceNowMs]);
  const whaleCount = recentLiquidations.filter((liquidation) => liquidation.value >= 100000).length;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animationFrameId: number;
    let width = canvas.width;
    let height = canvas.height;

    const resize = () => {
      width = canvas.parentElement?.clientWidth || canvas.clientWidth;
      height = canvas.parentElement?.clientHeight || canvas.clientHeight;
      // Adjust for retina displays
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    };
    
    window.addEventListener('resize', resize);
    resize();

    // Mapping states
    const PAPER_HEX = '#FAF9F6';
    const INK_HEX = '#121212';
    const GREEN_HEX = '#417D59'; // brand.mutedGreen
    const RED_HEX = '#A64D4D'; // brand.mutedRed
    const TURQUOISE_HEX = '#1A6B74'; // brand.turquoise

    // We keep a history of "scanned" area to leave trails, 
    // by constantly clearing with a high-opacity paper fill
    const render = () => {
      // Clear with slight transparency to leave a trail of past frames, 
      // though we redraw everything anyway. To make pure sharp dots:
      ctx.fillStyle = PAPER_HEX;
      ctx.fillRect(0, 0, width, height);

      // We pull liquidations completely raw
      const liqs = liquidations;
      
      const now = referenceNowMs;

      for (let i = 0; i < liqs.length; i++) {
        const l = liqs[i];
        const age = now - getTimestampMs(l);
        
        // Only draw dots within the last 2 minutes
        if (age < 0 || age > TIME_WINDOW_MS) continue;

        // X flows left
        const x = width - (age / TIME_WINDOW_MS) * width;
        
        // Y mapping: deterministic placement based on Asset name and Price.
        // Similar assets form physical bands.
        const charCode = l.symbol.charCodeAt(0) % 5; // 5 macro bands based on ticker
        const laneHeight = height / 5;
        
        // Map fractional price to vertical space within the lane
        const priceStr = l.price.toString();
        // Grab deterministic fractional slice (e.g. 0.345) to build a scatter effect
        const pseudoRand = parseFloat('0.' + (priceStr.split('.')[1] || priceStr.replace(/\D/g, '').slice(-3) || '5'));
        
        const y = (charCode * laneHeight) + (pseudoRand * laneHeight);

        const isMega = l.value > 1000000;
        const isHigh = l.value > 100000;
        const isBuy = l.side === 'BUY';
        
        const radius = isMega ? 4 : isHigh ? 2 : 0.8;

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        
        if (isMega) {
          ctx.fillStyle = TURQUOISE_HEX;
          ctx.shadowBlur = 8;
          ctx.shadowColor = TURQUOISE_HEX;
        } else {
          ctx.fillStyle = isBuy ? GREEN_HEX : RED_HEX;
          ctx.shadowBlur = isHigh ? 4 : 0;
          ctx.shadowColor = isBuy ? GREEN_HEX : RED_HEX;
        }
        
        // Introduce an alpha fade based on age so old liquidations fade out gracefully on the left edge
        const globalAlpha = Math.max(0, 1 - (age / TIME_WINDOW_MS));
        ctx.globalAlpha = globalAlpha;
        
        ctx.fill();
        ctx.globalAlpha = 1.0; // Reset
      }

      // Scanner Line (Current Time Playhead on the right)
      ctx.shadowBlur = 0;
      ctx.fillStyle = INK_HEX;
      ctx.fillRect(width - 2, 0, 2, height);
      
      animationFrameId = requestAnimationFrame(render);
    };
    
    render();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [liquidations, referenceNowMs]);

  return (
    <Box position="relative" w="100%" h={{ base: '140px', lg: '104px' }} borderTop="2px solid" borderBottom="2px solid" borderColor="brand.ink" bg="brand.paper" overflow="hidden">
      <HStack position="absolute" top={2} left={3} spacing={1} zIndex={10}>
        <Text fontSize="9px" fontWeight="900" color="brand.ink" letterSpacing="0.1em">
          LIQUIDATION MAP
        </Text>
        <InlineHelp title="LIQUIDATION MAP" body="Two-minute canvas of liquidation prints. The right edge is now, older prints drift left, and brighter dots represent larger prints." placement="right" />
      </HStack>
      <VStack position="absolute" top={2} right={4} zIndex={10} align="end" spacing={0}>
        <Text fontSize="7px" color={recentLiquidations.length > 0 ? 'brand.mutedGreen' : 'brand.mutedInk'} letterSpacing="0.08em" fontWeight="900">
          {recentLiquidations.length > 0 ? `${recentLiquidations.length} PRINTS / 2M` : 'WAITING FOR DATA'}
        </Text>
        <Text fontSize="7px" color="brand.mutedInk" letterSpacing="0.08em" fontWeight="700">
          LAST: {formatTime(latestLiquidation)}{whaleCount > 0 ? ` • ${whaleCount} LARGE` : ''}
        </Text>
      </VStack>
      {recentLiquidations.length === 0 && (
        <VStack
          position="absolute"
          inset={0}
          align="center"
          justify="center"
          spacing={1}
          zIndex={5}
          pointerEvents="none"
        >
          <Text fontSize="11px" fontWeight="800" color="brand.mutedInk">Waiting for liquidations</Text>
          <Text fontSize="9px" color="brand.mutedInk">The map fills once there are prints inside the current two-minute window.</Text>
        </VStack>
      )}
      <canvas 
        ref={canvasRef} 
        style={{ width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }} 
      />
    </Box>
  );
});
