'use client';
import { useEffect, useRef, useState } from 'react';
import { Connection, useReactFlow } from 'reactflow';

interface TouchHelpersProps {
  children: React.ReactNode;
  onEdgeStart?: (nodeId: string) => void;
  onEdgeComplete?: (connection: Connection) => void;
  onLongPress?: (nodeId: string, event: TouchEvent) => void;
}

export function TouchHelpers({ 
  children, 
  onEdgeStart, 
  onEdgeComplete, 
  onLongPress 
}: TouchHelpersProps) {
  const { getNode } = useReactFlow();
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const touchStartRef = useRef<{ nodeId: string; startTime: number } | null>(null);
  const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleTouchStart = (event: TouchEvent, nodeId: string) => {
    const startTime = Date.now();
    touchStartRef.current = { nodeId, startTime };

    // Set up long press detection
    longPressTimeoutRef.current = setTimeout(() => {
      if (touchStartRef.current?.nodeId === nodeId) {
        onLongPress?.(nodeId, event);
      }
    }, 500); // 500ms long press
  };

  const handleTouchEnd = (event: TouchEvent, nodeId: string) => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }

    if (!touchStartRef.current) return;

    const { nodeId: startNodeId, startTime } = touchStartRef.current;
    const duration = Date.now() - startTime;

    // If it was a quick tap (not long press) and we're in connecting mode
    if (duration < 500 && isConnecting && connectingFrom && connectingFrom !== nodeId) {
      const connection: Connection = {
        source: connectingFrom,
        target: nodeId,
        sourceHandle: null,
        targetHandle: null,
      };
      
      onEdgeComplete?.(connection);
      setIsConnecting(false);
      setConnectingFrom(null);
    }

    touchStartRef.current = null;
  };

  const handleTouchCancel = () => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
    touchStartRef.current = null;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (longPressTimeoutRef.current) {
        clearTimeout(longPressTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      onTouchStart={(e) => {
        const target = e.target as HTMLElement;
        const nodeElement = target.closest('[data-id]');
        if (nodeElement) {
          const nodeId = nodeElement.getAttribute('data-id');
          if (nodeId) {
            handleTouchStart(e.nativeEvent, nodeId);
          }
        }
      }}
      onTouchEnd={(e) => {
        const target = e.target as HTMLElement;
        const nodeElement = target.closest('[data-id]');
        if (nodeElement) {
          const nodeId = nodeElement.getAttribute('data-id');
          if (nodeId) {
            handleTouchEnd(e.nativeEvent, nodeId);
          }
        }
      }}
      onTouchCancel={handleTouchCancel}
    >
      {children}
      
      {/* Connection mode indicator */}
      {isConnecting && (
        <div className="fixed inset-0 bg-blue-500/20 pointer-events-none z-50 flex items-center justify-center">
          <div className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg">
            Tap another node to connect from {connectingFrom}
          </div>
        </div>
      )}
    </div>
  );
}

// Hook for managing touch interactions
export function useTouchInteractions() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);

  const startConnection = (nodeId: string) => {
    setIsConnecting(true);
    setConnectingFrom(nodeId);
  };

  const cancelConnection = () => {
    setIsConnecting(false);
    setConnectingFrom(null);
  };

  const completeConnection = (targetNodeId: string) => {
    if (isConnecting && connectingFrom && connectingFrom !== targetNodeId) {
      const connection: Connection = {
        source: connectingFrom,
        target: targetNodeId,
        sourceHandle: null,
        targetHandle: null,
      };
      
      setIsConnecting(false);
      setConnectingFrom(null);
      return connection;
    }
    return null;
  };

  return {
    isConnecting,
    connectingFrom,
    startConnection,
    cancelConnection,
    completeConnection,
  };
}
