import { useState } from 'react';
import { Box, Input, Button, Text } from '@chakra-ui/react';
import { useWebSocket } from '@/context/websocket-context';


function MusicPanel(): JSX.Element {
  const [musicUrl, setMusicUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { baseUrl } = useWebSocket();

  const handleSubmit = async () => {
    if (!musicUrl.trim()) return;

    setIsSubmitting(true);
    try {
      // const response = await fetch('https://2871-219-70-65-54.ngrok-free.app/api/music', {
      const response = await fetch(baseUrl+'/api/music', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: musicUrl,id:(window as any).ws_musicId }),
      });

      if (!response.ok) throw new Error('伺服器錯誤');

      console.log('✅ 送出成功:', musicUrl);
      setMusicUrl('');
    } catch (error) {
      console.error('❌ 送出失敗:', (error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  async function stopSing(){
    (window as any).current_vocalSource.stop();
    (window as any).current_instrumentSource.stop();
    (window as any).stopTime = (window as any).audioContext.currentTime - (window as any).initStartTime;
    (window as any).initStartTime = 99999;
    (window as any).singQueue = [];

    try {
      const response = await fetch(baseUrl+'/api/stop_uvr', {
        method: 'POST'
      });

      if (!response.ok) throw new Error('伺服器錯誤');

      console.log('✅ 送出成功');
      setMusicUrl('');
    } catch (error) {
      console.error('❌ 送出失敗:', (error as Error).message);
    }
  }

  return (
    <Box p={4} border="1px solid" borderColor="gray.600" borderRadius="md" bg="gray.800">
      <Text fontSize="lg" fontWeight="bold" mb={2} color="white">
        播放
      </Text>
      <Input
        id="PlayMusic"
        placeholder="輸入音樂網址"
        value={musicUrl}
        onChange={(e) => setMusicUrl(e.target.value)}
        mb={3}
        bg="white"
        color="black"
      />
  <Box textAlign="right">
        <Button
          colorScheme="teal"
          onClick={handleSubmit}
          disabled={!musicUrl.trim() || isSubmitting}
        >
          送出
        </Button>
        <Button
          id="StopSing"
          colorScheme="teal"
          onClick={stopSing}
        >
          停止
        </Button>
      </Box>
    </Box>
  );
}

export default MusicPanel;
