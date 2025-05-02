import { useEffect } from 'react';
import { Box, Text } from '@chakra-ui/react';
import { FiCamera } from 'react-icons/fi';
import { Tooltip } from '@/components/ui/tooltip';
import { sidebarStyles } from './sidebar-styles';
import { useCameraPanel } from '@/hooks/sidebar/use-camera-panel';

// Reusable components
function LiveIndicator() {
  return (
    <Box color="red.500" display="flex" alignItems="center" gap={2}>
      <Box w="8px" h="8px" borderRadius="full" bg="red.500" animation="pulse 2s infinite" />
      <Text fontSize="sm">Live</Text>
    </Box>
  );
}

function CameraPlaceholder() {
  return (
    <Box
      position="absolute"
      display="flex"
      flexDirection="column"
      alignItems="center"
      gap={2}
    >
      <FiCamera size={24} />
      <Text color="whiteAlpha.600" fontSize="sm" textAlign="center">
        Click to start camera
      </Text>
    </Box>
  );
}

function VideoStream({
  videoRef,
  isStreaming,
}: {
  videoRef: React.RefObject<HTMLVideoElement>
  isStreaming: boolean
}) {
  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      style={sidebarStyles.cameraPanel.video}
      {...(isStreaming ? {} : { display: 'none' })}
    />
  );
}

// Main component
function CameraPanel(): JSX.Element {
  const {
    videoRef,
    error,
    isHovering,
    isStreaming,
    stream,
    toggleCamera,
    handleMouseEnter,
    handleMouseLeave,
  } = useCameraPanel();

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <Box {...sidebarStyles.cameraPanel.container}>
      <Box {...sidebarStyles.cameraPanel.header}>
        {isStreaming && <LiveIndicator />}
      </Box>

      <Tooltip
        showArrow
        content={isStreaming ? 'Click to stop camera' : 'Click to start camera'}
        open={isHovering && !error}
      >
        <Box
          {...sidebarStyles.cameraPanel.videoContainer}
          onClick={toggleCamera}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          cursor="pointer"
          position="relative"
          _hover={{
            bg: 'whiteAlpha.100',
          }}
        >
          {error ? (
            <Text color="red.300" fontSize="sm" textAlign="center">
              {error}
            </Text>
          ) : (
            <>
              <VideoStream videoRef={videoRef} isStreaming={isStreaming} />
              {!isStreaming && <CameraPlaceholder />}
            </>
          )}
        </Box>
      </Tooltip>
    </Box>
  );
}

export default CameraPanel;
