import React, { createContext, useContext, useState, useMemo } from 'react';

interface GroupContextState {
  selfUid: string;
  selfName: string;
  groupMembers: string[];
  isOwner: boolean;
  setSelfUid: (uid: string) => void;
  setSelfName: (name: string) => void;
  setGroupMembers: (members: string[]) => void;
  setIsOwner: (isOwner: boolean) => void;
  sortedGroupMembers: string[];
  resetGroupState: () => void;
}

const GroupContext = createContext<GroupContextState | null>(null);

export function GroupProvider({ children }: { children: React.ReactNode }) {
  const [selfUid, setSelfUid] = useState('');
  const [selfName, setSelfName] = useState(() => {
  const random4Digit = Math.floor(1000 + Math.random() * 9000);
    return `人類${random4Digit}`;
  });
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const [isOwner, setIsOwner] = useState(false);

  const resetGroupState = () => {
    setGroupMembers([]);
    setIsOwner(false);
  };

  const sortedGroupMembers = useMemo(() => {
    if (!groupMembers.includes(selfUid)) return groupMembers;

    return [
      selfUid,
      ...groupMembers.filter((memberId) => memberId !== selfUid),
    ];
  }, [groupMembers, selfUid]);

  return (
    // eslint-disable-next-line react/jsx-no-constructed-context-values
    <GroupContext.Provider value={{
      selfUid,
      selfName,
      groupMembers,
      isOwner,
      setSelfUid,
      setSelfName,
      setGroupMembers,
      setIsOwner,
      sortedGroupMembers,
      resetGroupState,
    }}
    >
      {children}
    </GroupContext.Provider>
  );
}

export function useGroup() {
  const context = useContext(GroupContext);
  if (!context) {
    throw new Error('useGroup must be used within a GroupProvider');
  }
  return context;
}
