import { useState, useCallback } from 'react';
import { useWebSocket } from '@/context/websocket-context';
import { toaster } from '@/components/ui/toaster';
import { useGroup } from "@/context/group-context";

export const useGroupDrawer = () => {
  const { selfName} = useGroup();
  const [isOpen, setIsOpen] = useState(false);
  const [inviteUid, setInviteUid] = useState('');
  const { sendMessage } = useWebSocket();

  // Request latest group information to update the display
  const requestGroupInfo = useCallback(() => {
    sendMessage({
      type: 'request-group-info',
    });
  }, [sendMessage]);

  const handleChangeName = useCallback(async () =>{
    sendMessage({
      type: 'change-client-name',
      client_name:selfName
    });
    return;
  },[selfName,sendMessage,requestGroupInfo])

  const handleInvite = useCallback(async () => {
    if (!inviteUid.trim()) {
      toaster.create({
        title: 'Please enter a valid UUID',
        type: 'error',
        duration: 2000,
      });
      return;
    }

    sendMessage({
      type: 'add-client-to-group',
      invitee_uid: inviteUid.trim(),
    });
    setInviteUid('');

    // Add a small delay to ensure server has processed the operation
    setTimeout(requestGroupInfo, 100);
  }, [inviteUid, sendMessage, requestGroupInfo]);

  const handleRemove = useCallback((targetUid: string) => {
    sendMessage({
      type: 'remove-client-from-group',
      target_uid: targetUid,
    });

    // Add a small delay to ensure server has processed the operation
    setTimeout(requestGroupInfo, 100);
  }, [sendMessage, requestGroupInfo]);

  const handleLeaveGroup = useCallback((selfUid: string) => {
    sendMessage({
      type: 'remove-client-from-group',
      target_uid: selfUid,
    });

    // Add a small delay to ensure server has processed the operation
    setTimeout(requestGroupInfo, 100);
  }, [sendMessage, requestGroupInfo]);

  return {
    isOpen,
    setIsOpen,
    handleChangeName,
    inviteUid,
    setInviteUid,
    handleInvite,
    handleRemove,
    handleLeaveGroup,
    requestGroupInfo,
  };
};
