import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import Spline from '@splinetool/react-spline';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [isSplineLoaded, setIsSplineLoaded] = useState(false);

  useEffect(() => {
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.backgroundColor = 'black';

    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

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

  return (
    <main className="fixed inset-0 w-screen h-screen overflow-hidden bg-black text-white font-sans select-none">
      
      {/* Background Spline Container */}
      <div 
        className={`absolute inset-0 z-0 w-full h-full pointer-events-auto bg-black transition-all duration-700 ease-in-out ${
          isSplineLoaded ? 'opacity-100 scale-170' : 'opacity-0 scale-100'
        }`}
      >
        {/* scale-110 above zooms the entire 3D scene canvas in by 10% */}
        <Spline 
          scene="https://prod.spline.design/ENn3DB1pDsuCgX2K/scene.splinecode" 
          onLoad={() => setIsSplineLoaded(true)} 
        />
      </div>

      {/* Live Notifications Overlay Layer */}
      {isSplineLoaded && (
        <div className="absolute inset-0 z-10 flex justify-end items-start p-6 md:p-12 pointer-events-none overflow-hidden animate-fade-in">
          <div className="w-full md:w-80 max-h-full flex flex-col gap-3 overflow-y-auto pointer-events-auto">
            {notifications.map((notif, index) => (
              <div 
                key={index} 
                className="bg-slate-900/70 border border-slate-800 text-slate-100 p-4 rounded-xl shadow-2xl text-xs md:text-sm backdrop-blur-md"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <p className="font-medium">{notif}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

export default App;