import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    // Listen for events published from the worker -> redis -> api -> websocket
    newSocket.on('RegistrationConfirmed', (data) => {
      setNotifications(prev => [
        `Yay! Registration confirmed for event ${data.eventId}!`, 
        ...prev
      ]);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const handleRegister = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'test-student-id-123',
          eventId: 'test-event-id-456'
        })
      });
      
      const data = await response.json();
      if (!response.ok) {
        alert(data.error);
      } else {
        alert(`Registered: ${data.registration.status}`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-20">
      <h1 className="text-4xl font-bold text-gray-900 mb-8 w-full max-w-4xl text-center">
        School Events & Notifications Dashboard
      </h1>

      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md border border-gray-100">
        <h2 className="text-xl font-semibold mb-2 text-center text-gray-800">Registration Testing Simulator</h2>
        <p className="text-gray-500 mb-6 flex text-center text-sm">
          Simulates clicking register. The backend uses strict Postgres row-level locking, saves an outbox event, and the detached worker processes it entirely off the main thread.
        </p>

        <button 
          onClick={handleRegister}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-md font-medium hover:bg-blue-700 transition disabled:opacity-50 shadow-sm"
        >
          {loading ? 'Processing Transaction...' : 'Register for Dummy Event'}
        </button>

        <div className="mt-8">
          <h3 className="font-medium text-gray-800 mb-3 border-b flex justify-between pb-2">
            <span>WebSocket Live Updates</span>
            <span className="relative flex h-3 w-3 mt-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
          </h3>
          
          <ul className="space-y-3">
            {notifications.length === 0 && (
              <li className="text-gray-400 text-sm italic text-center py-4 bg-gray-50 rounded border border-dashed">Waiting for Redis broadcasts...</li>
            )}
            {notifications.map((note, i) => (
              <li key={i} className="bg-green-50 text-green-800 p-3 flex rounded text-sm shadow-sm border border-green-200">
                <svg className="w-5 h-5 mr-2 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                {note}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default App;