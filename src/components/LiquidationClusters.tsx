import React, { useEffect, useState, useMemo } from 'react';
import {
  Box,
  Text,
  VStack,
  HStack,
  Flex,
  Tooltip,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
} from '@chakra-ui/react';
import { useClusteringStore, LiqCluster } from '../store/clusteringStore';

interface Props {
  minAmount: number;
}

export const LiquidationClusters: React.FC<Props> = React.memo(({ minAmount }) => {
  const { clusters, pruneClusters } = useClusteringStore();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedCluster, setSelectedCluster] = useState<LiqCluster | null>(null);
  
  useEffect(() => {
    const interval = setInterval(pruneClusters, 60000);
    return () => clearInterval(interval);
  }, [pruneClusters]);
  
  // Rank clusters by total value and filter by minAmount
  const sortedClusters = useMemo(() => 
    clusters
      .filter(c => c.totalValue >= minAmount)
      .sort((a, b) => b.totalValue - a.totalValue),
    [clusters, minAmount]
  );

  const handleClusterClick = (cluster: LiqCluster) => {
    setSelectedCluster(cluster);
    onOpen();
  };

  if (sortedClusters.length === 0) {
    return (
      <Flex direction="column" align="center" justify="center" h="100%" color="brand.mutedInk" opacity={0.5}>
        <Text fontSize="10px" fontFamily="mono" fontWeight="700">NO ACTIVE CLUSTERS</Text>
        <Text fontSize="8px" fontFamily="mono">Awaiting volatility...</Text>
      </Flex>
    );
  }

  return (
    <>
      <Box 
        overflowY="auto" 
        h="100%" 
        pr={2}
        css={{
          '&::-webkit-scrollbar': { width: '2px' },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': { background: 'rgba(0,0,0,0.1)' },
        }}
      >
        <VStack align="stretch" spacing={2}>
          {sortedClusters.map((cluster) => (
            <ClusterRow 
              key={cluster.id} 
              cluster={cluster} 
              onClick={() => handleClusterClick(cluster)}
            />
          ))}
        </VStack>
        <Text fontSize="8px" color="brand.mutedInk" textAlign="center" py={4} fontFamily="mono" opacity={0.6}>
          RANKED BY TOTAL VOLUME INTENSITY (L10M)
        </Text>
      </Box>

      {/* Cluster Detail Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="lg" isCentered>
        <ModalOverlay bg="rgba(0,0,0,0.4)" backdropFilter="blur(2px)" />
        <ModalContent 
          borderRadius="0" 
          bg="brand.paper" 
          border="2px solid" 
          borderColor="brand.ink"
          boxShadow="none"
        >
          <ModalHeader 
            fontSize="14px" 
            fontWeight="900" 
            fontFamily="mono" 
            borderBottom="1px solid" 
            borderColor="brand.border"
            pb={2}
          >
            CLUSTER BREAKDOWN: {selectedCluster?.baseAsset}
          </ModalHeader>
          <ModalCloseButton borderRadius="0" _hover={{ bg: 'brand.ink', color: 'brand.paper' }} />
          <ModalBody p={0}>
            <TableContainer maxH="400px" overflowY="auto">
              <Table variant="simple" size="sm">
                <Thead bg="brand.paper" position="sticky" top={0}>
                  <Tr>
                    < Th fontSize="9px" fontFamily="mono">EXCH</ Th>
                    < Th isNumeric fontSize="9px" fontFamily="mono">PRICE</ Th>
                    < Th isNumeric fontSize="9px" fontFamily="mono">VALUE</ Th>
                    < Th isNumeric fontSize="9px" fontFamily="mono">TIME</ Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {selectedCluster?.events.map((ev, idx) => (
                    <Tr key={idx} fontSize="11px">
                      <Td fontFamily="mono" py={1}>{ev.exchange.slice(0,3)}</Td>
                      <Td isNumeric fontFamily="mono" py={1}>{ev.price < 1 ? ev.price.toFixed(4) : ev.price.toFixed(2)}</Td>
                      <Td isNumeric fontFamily="mono" fontWeight="700" py={1}>${ev.value >= 1000 ? (ev.value / 1000).toFixed(1) + 'K' : Math.round(ev.value)}</Td>
                      <Td isNumeric fontFamily="mono" color="brand.mutedInk" py={1}>
                        {ev.timestamp.toFormat('HH:mm:ss')}
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableContainer>
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
});


const ClusterRow: React.FC<{ cluster: LiqCluster, onClick: () => void }> = ({ cluster, onClick }) => {
  const isBuy = cluster.side === 'BUY';
  const color = isBuy ? 'brand.mutedGreen' : 'brand.mutedRed';
  const intensity = Math.min(cluster.totalValue / 1000000, 1); // Max intensity at 1M
  
  const formatPrice = (price: number) => {
    if (price >= 1000) return price.toLocaleString(undefined, { maximumFractionDigits: 0 });
    return price.toLocaleString(undefined, { maximumFractionDigits: 4 });
  };

  return (
    <Box 
      borderBottom="1px solid" 
      borderColor="brand.border" 
      pb={2} 
      position="relative"
      cursor="pointer"
      onClick={onClick}
      _hover={{ bg: 'rgba(0,0,0,0.03)' }}
      transition="all 0.1s"
      px={2}
    >
      <Flex justify="space-between" align="center">
        <VStack align="start" spacing={0}>
          <HStack spacing={2}>
            <Text fontSize="12px" fontWeight="900" color="brand.ink">{cluster.baseAsset}</Text>
            <Box 
              px={1} 
              border="1px solid" 
              borderColor={color} 
              fontSize="8px" 
              fontWeight="900" 
              color={color}
              borderRadius="0"
            >
              {isBuy ? 'SHORT CLUSTER' : 'LONG CLUSTER'}
            </Box>
          </HStack>
          <Text fontSize="10px" fontFamily="mono" color="brand.mutedInk">
            {formatPrice(cluster.minPrice)} - {formatPrice(cluster.maxPrice)}
          </Text>
        </VStack>
        
        <VStack align="end" spacing={0}>
          <Text fontSize="12px" fontWeight="900" color="brand.ink">
            ${cluster.totalValue >= 1000000 
              ? (cluster.totalValue / 1000000).toFixed(2) + 'M' 
              : cluster.totalValue >= 1000 ? (cluster.totalValue / 1000).toFixed(1) + 'K' : Math.round(cluster.totalValue)}
          </Text>
          <Box h="2px" w="40px" bg="brand.border" position="relative">
            <Box 
              position="absolute" 
              top={0} 
              left={0} 
              h="100%" 
              bg={color} 
              w={`${intensity * 100}%`}
              transition="width 0.5s ease-out"
            />
          </Box>
        </VStack>
      </Flex>
    </Box>
  );
};
