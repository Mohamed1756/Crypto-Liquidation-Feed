import React from 'react';
import { SimpleGrid, Stat, StatLabel, StatNumber, StatHelpText, Icon, Tooltip } from '@chakra-ui/react';
import { FaChartLine, FaFire, FaInfoCircle } from 'react-icons/fa';
import { useLiquidationStore } from '../store/liquidationStore';

export const Stats: React.FC = () => {
  const { totalValue, stats, highScore } = useLiquidationStore();

  return (
    <SimpleGrid columns={{ base: 1, md: 4 }} spacing={{ base: 5, lg: 8 }}>
      <Stat
        px={{ base: 2, md: 4 }}
        py="5"
        shadow="xl"
        border="1px solid"
        borderColor="gray.500"
        rounded="lg"
      >
      <StatLabel fontWeight="medium" display="flex" alignItems="center">
  <Icon as={FaChartLine} mr={2} /> Total Value
</StatLabel>
<StatNumber fontSize="2xl">
  {Math.round(totalValue).toLocaleString()} USDT
</StatNumber>
<StatHelpText>High Score: {highScore.toFixed(2).toLocaleString()} USDT</StatHelpText>
    </Stat>

      <Stat
        px={{ base: 2, md: 4 }}
        py="5"
        shadow="xl"
        border="1px solid"
        borderColor="green.500"
        rounded="lg"
      >
       <StatLabel fontWeight="medium" display="flex" alignItems="center" gap={2}>
          Buy Liquidations
          <Tooltip label="Short Position Liquidations" aria-label="Short Position Liquidations Tooltip" placement="top" hasArrow>
            <span  style={{ position: 'relative', top: '2px' }}>
            <Icon as={FaInfoCircle} w={4} h={4} color="gray.300" opacity={0.3}  />
            </span>
          </Tooltip>
        </StatLabel>
        <StatNumber fontSize="2xl">{stats.buyCount}</StatNumber>
      </Stat>

      <Stat
        px={{ base: 2, md: 4 }}
        py="5"
        shadow="xl"
        border="1px solid"
        borderColor="red.500"
        rounded="lg"
      >
        <StatLabel fontWeight="medium" display="flex" alignItems="center" gap={2}>
          Sell Liquidations
          <Tooltip label="Long Position Liquidations" aria-label="Long Position Liquidations Tooltip" placement="top" hasArrow>
            <span  style={{ position: 'relative', top: '2px' }}>
            <Icon as={FaInfoCircle} w={4} h={4} color="gray.300" opacity={0.3} />
            </span>
          </Tooltip>
        </StatLabel>
        <StatNumber fontSize="2xl">{stats.sellCount}</StatNumber>
      </Stat>
      <Stat
        px={{ base: 2, md: 4 }}
        py="5"
        shadow="xl"
        border="1px solid"
        borderColor="orange.500"
        rounded="lg"
      >
        <StatLabel fontWeight="medium" display="flex" alignItems="center">
          <Icon as={FaFire} mr={2} /> Daily Streak
        </StatLabel>
        <StatNumber fontSize="2xl">{stats.dailyStreak} days</StatNumber>
      </Stat>
    </SimpleGrid>
  );
};