import React from 'react';
import {
  Box,
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  Text,
} from '@chakra-ui/react';
import { QuestionIcon } from '@chakra-ui/icons';

interface InlineHelpProps {
  title?: string;
  body: string;
  width?: string;
  placement?: React.ComponentProps<typeof Popover>['placement'];
}

export const InlineHelp: React.FC<InlineHelpProps> = ({
  title,
  body,
  width = '260px',
  placement = 'top',
}) => {
  return (
    <Popover trigger="hover" placement={placement} openDelay={120}>
      <PopoverTrigger>
        <Box
          as="button"
          type="button"
          display="inline-flex"
          alignItems="center"
          justifyContent="center"
          color="brand.mutedInk"
          opacity={0.75}
          cursor="help"
          aria-label={title || 'More information'}
          _hover={{ opacity: 1, color: 'brand.ink' }}
          transition="all 0.2s"
        >
          <QuestionIcon boxSize="10px" />
        </Box>
      </PopoverTrigger>
      <PopoverContent
        bg="brand.paper"
        borderColor="brand.ink"
        borderWidth="1px"
        borderRadius="0"
        boxShadow="none"
        width={width}
        zIndex={20}
      >
        <PopoverBody p={3}>
          {title ? (
            <Text
              fontSize="9px"
              fontWeight="900"
              fontFamily="mono"
              color="brand.ink"
              letterSpacing="0.08em"
              mb={2}
            >
              {title}
            </Text>
          ) : null}
          <Text fontSize="10px" lineHeight="1.5" color="brand.ink" fontFamily="mono">
            {body}
          </Text>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
};