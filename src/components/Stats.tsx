import React from 'react';
import { SimpleGrid, Stat, StatLabel, StatNumber, StatHelpText, Icon, Tooltip, Box } from '@chakra-ui/react';
import { FaChartLine, FaFire, FaInfoCircle } from 'react-icons/fa';
import { useLiquidationStore } from '../store/liquidationStore';

export const Stats: React.FC = () => {
  const { totalValue, stats, highScore } = useLiquidationStore();

  const statStyle = {
    px: { base: 2, md: 4 },
    py: "5",
    border: "1px solid",
    borderColor: "brand.border",
    bg: "brand.paper",
    borderRadius: "0",
  };

  return (
    <SimpleGrid columns={{ base: 1, md: 4 }} spacing={{ base: 5, lg: 8 }}>
      <Stat {...statStyle}>
        <StatLabel fontWeight="medium" display="flex" alignItems="center">
          <Icon as={FaChartLine} mr={2} /> Total Value $
        </StatLabel>
        <StatNumber fontSize="2xl">
          {Math.round(totalValue).toLocaleString()} 
        </StatNumber>
        <StatHelpText>High Score: {highScore.toFixed(2).toLocaleString()} USDT</StatHelpText>
      </Stat>

      <Stat {...statStyle} borderColor="brand.mutedGreen">
        <StatLabel fontWeight="medium" display="flex" alignItems="center" gap={2}>
          Buy Liquidations
          <Tooltip label="Short Position Liquidations" aria-label="Short Position Liquidations Tooltip" placement="top" hasArrow>
            <Box as="span" position="relative" top="2px">
              <Icon as={FaInfoCircle} w={4} h={4} color="gray.300" opacity={0.3}  />
            </Box>
          </Tooltip>
        </StatLabel>
        <StatNumber fontSize="2xl">{stats.buyCount}</StatNumber>
      </Stat>

      <Stat {...statStyle} borderColor="brand.mutedRed">
        <StatLabel fontWeight="medium" display="flex" alignItems="center" gap={2}>
          Sell Liquidations
          <Tooltip label="Long Position Liquidations" aria-label="Long Position Liquidations Tooltip" placement="top" hasArrow>
            <Box as="span" position="relative" top="2px">
              <Icon as={FaInfoCircle} w={4} h={4} color="gray.300" opacity={0.3} />
            </Box>
          </Tooltip>
        </StatLabel>
        <StatNumber fontSize="2xl">{stats.sellCount}</StatNumber>
      </Stat>

      <Stat {...statStyle}>
        <StatLabel fontWeight="medium" display="flex" alignItems="center">
          <Icon as={FaFire} mr={2} /> Daily Streak
        </StatLabel>
        <StatNumber fontSize="2xl">{stats.dailyStreak} days</StatNumber>
      </Stat>
    </SimpleGrid>
  );
};