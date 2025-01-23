import React from 'react';
import {
  Box,
  VStack,
  Text,
  Badge,
  useColorModeValue,
  Tooltip,
  Grid
} from '@chakra-ui/react';
import { useLiquidationStore } from '../store/liquidationStore';
import { motion } from 'framer-motion';

const MotionBox = motion(Box);

export const Achievements: React.FC = () => {
  const achievements = useLiquidationStore((state) => state.achievements);
  const bgColor = useColorModeValue('white', 'gray.800');

  return (
    <Box p={4} bg={bgColor} rounded="lg" shadow="lg" width="100%">
      <Text fontSize="xl" fontWeight="bold" mb={4}>
        Achievements
      </Text>
      <Grid templateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap={4}>
        {achievements.map((achievement) => (
          <MotionBox
            key={achievement.id}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            initial={achievement.unlocked ? { opacity: 1 } : { opacity: 0.6 }}
            animate={achievement.unlocked ? { opacity: 1 } : { opacity: 0.6 }}
          >
            <Tooltip
              label={achievement.unlocked ? `Unlocked: ${achievement.timestamp?.toFormat('ff')}` : 'Locked'}
              placement="top"
            >
              <Box
                p={3}
                border="1px solid"
                borderColor={achievement.unlocked ? 'green.500' : 'gray.500'}
                rounded="md"
                position="relative"
              >
                <Badge
                  position="absolute"
                  top={2}
                  right={2}
                  colorScheme={achievement.unlocked ? 'green' : 'gray'}
                >
                  {achievement.unlocked ? 'Unlocked' : 'Locked'}
                </Badge>
                <VStack align="start" spacing={1}>
                  <Text fontSize="lg" fontWeight="bold">
                    {achievement.title}
                  </Text>
                  <Text fontSize="sm" color="gray.500">
                    {achievement.description}
                  </Text>
                </VStack>
              </Box>
            </Tooltip>
          </MotionBox>
        ))}
      </Grid>
    </Box>
  );
};