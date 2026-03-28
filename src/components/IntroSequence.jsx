import { motion, useMotionValue, useTransform, useAnimation } from 'framer-motion';
import { useState, useEffect } from 'react';
import '../styles/global.css';

const IntroSequence = ({ onComplete, progress }) => {
  const [isDragging, setIsDragging] = useState(false);
  const controls = useAnimation();
  const dragY = useMotionValue(0);

  // Sync dragY to the shared progress value (0 to 1)
  // Max drag distance = 300px
  useEffect(() => {
    const unsubscribe = dragY.on("change", (latest) => {
      const newProgress = Math.min(Math.max(latest / 300, 0), 1);
      progress.set(newProgress);
    });
    return unsubscribe;
  }, [dragY, progress]);

  // Visual transforms based on drag
  // As we pull down (dragY increases):
  // 1. The cabinet face moves down (y)
  // 2. It rotates slightly to simulate the drawer angle
  // 3. It fades out eventually
  const faceY = useTransform(dragY, [0, 300], [0, 600]);
  const faceRotateX = useTransform(dragY, [0, 300], [0, -20]);
  const opacity = useTransform(dragY, [200, 300], [1, 0]);

  const handleDragEnd = async (event, info) => {
    setIsDragging(false);
    if (dragY.get() > 150) {
      // Complete the animation
      await controls.start({
        y: 600,
        opacity: 0,
        transition: { duration: 0.5 }
      });
      progress.set(1); // Ensure progress is maxed
      onComplete();
    } else {
      // Snap back
      dragY.set(0);
      progress.set(0);
    }
  };

  return (
    <div className="intro-container" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 200, // Above FileCabinet
      pointerEvents: 'none' // Let clicks pass through to drag handle
    }}>
      <motion.div
        className="cabinet-face aluminum-texture"
        drag="y"
        dragConstraints={{ top: 0, bottom: 300 }}
        dragElastic={0.1}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={handleDragEnd}
        style={{
          y: dragY, // Bind drag
          rotateX: faceRotateX,
          opacity: opacity,
          width: '340px',
          height: '500px',
          backgroundColor: '#FFFFFF',
          borderRadius: '4px',
          position: 'relative',
          boxShadow: '0 20px 50px rgba(0,0,0,0.15), inset 0 0 0 1px rgba(0,0,0,0.05)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: '60px',
          pointerEvents: 'auto', // Re-enable pointer events for the face
          cursor: isDragging ? 'grabbing' : 'grab',
          transformPerspective: '1000px',
          transformOrigin: 'bottom center'
        }}
        animate={controls}
      >
        {/* Label Holder */}
        <div style={{
          width: '140px',
          height: '50px',
          backgroundColor: '#fff',
          border: '1px solid #e0e0e0',
          marginBottom: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)'
        }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            color: '#FF6B35', // Orange Accent
            fontSize: '0.9rem',
            fontWeight: 600,
            letterSpacing: '0.1em'
          }}>
            PORTFOLIO
          </span>
        </div>

        {/* Handle */}
        <div style={{
          width: '160px',
          height: '30px',
          background: 'linear-gradient(180deg, #f5f5f5 0%, #d4d4d4 100%)',
          borderRadius: '4px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {/* Grip Texture */}
          <div style={{ width: '80%', height: '2px', backgroundColor: 'rgba(0,0,0,0.1)', marginBottom: '2px' }} />
          <div style={{ width: '80%', height: '2px', backgroundColor: 'rgba(0,0,0,0.1)' }} />
        </div>

        {/* Prompt Text */}
        <motion.div
          style={{
            marginTop: '20px',
            textAlign: 'center',
            opacity: isDragging ? 0 : 1
          }}
          animate={{ y: [0, 5, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.7rem',
            color: '#999',
            textTransform: 'uppercase'
          }}>
            Pull to Open
          </span>
          <div style={{ color: '#FF6B35', fontSize: '1.2rem' }}>↓</div>
        </motion.div>

        {/* Decorative Screws */}
        <div style={{ position: 'absolute', top: '20px', left: '20px', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#d4d4d4', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)' }} />
        <div style={{ position: 'absolute', top: '20px', right: '20px', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#d4d4d4', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)' }} />
        <div style={{ position: 'absolute', bottom: '20px', left: '20px', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#d4d4d4', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)' }} />
        <div style={{ position: 'absolute', bottom: '20px', right: '20px', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#d4d4d4', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)' }} />

      </motion.div>
    </div>
  );
};

export default IntroSequence;
