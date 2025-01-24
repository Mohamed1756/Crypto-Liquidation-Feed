import React from 'react';
import {SimpleGrid, Stat, StatLabel, StatNumber, StatHelpText, Icon } from '@chakra-ui/react';
import { FaChartLine, FaFire } from 'react-icons/fa';
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
        <StatNumber fontSize="2xl">{totalValue.toFixed(2)} USDT</StatNumber>
        <StatHelpText>High Score: {highScore.toFixed(2)} USDT</StatHelpText>
      </Stat>
      
      <Stat
        px={{ base: 2, md: 4 }}
        py="5"
        shadow="xl"
        border="1px solid"
        borderColor="green.500"
        rounded="lg"
      >
        <StatLabel fontWeight="medium">Buy Liquidations</StatLabel>
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
        <StatLabel fontWeight="medium">Sell Liquidations</StatLabel>
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