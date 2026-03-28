import { useState, useRef, useEffect } from 'react';
import { motion, useTransform } from 'framer-motion';
import FileFolder from './FileFolder';

const FileCabinet = ({ onOpenFile, introProgress, isIntro }) => {
    const containerRef = useRef(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    // Intro Animations based on shared progress (0 to 1)
    // 0 = Start of intro (looking at front)
    // 1 = End of intro (looking top-down)

    // If we are NOT in intro mode (introProgress is undefined), we default to "open" state values
    const defaultProgress = 1;

    // We need to handle the case where introProgress is passed vs not passed
    // However, hooks can't be conditional.
    // So we'll use the passed motion value if it exists, otherwise we just use static values.

    const rotateX = useTransform(introProgress || { get: () => 1, onChange: () => { } }, [0, 1], [-45, 0]);
    const y = useTransform(introProgress || { get: () => 1, onChange: () => { } }, [0, 1], [200, 0]);
    const opacity = useTransform(introProgress || { get: () => 1, onChange: () => { } }, [0.2, 1], [0, 1]);
    const scale = useTransform(introProgress || { get: () => 1, onChange: () => { } }, [0, 1], [0.8, 1]);

    const handleMouseMove = (e) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        setMousePos({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        });
    };

    const files = [
        { id: 'about', label: 'ABOUT_ME', color: '#E0C097' },
        { id: 'projects', label: 'PROJECTS', color: '#E8C8A0' },
        { id: 'experience', label: 'EXPERIENCE', color: '#F0D0A9' },
        { id: 'contact', label: 'CONTACT_INFO', color: '#F8D8B2' },
    ];

    return (
        <motion.div
            className="cabinet-container"
            ref={containerRef}
            onMouseMove={handleMouseMove}
            style={{
                width: '100%',
                height: '100vh',
                backgroundColor: '#1a1a1a', // Dark interior of cabinet
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2rem',
                overflow: 'hidden',
                position: 'relative',
                boxShadow: 'inset 0 0 100px rgba(0,0,0,0.5)', // Deep shadow for depth
                // Apply transforms
                rotateX: isIntro ? rotateX : 0,
                y: isIntro ? y : 0,
                opacity: isIntro ? opacity : 1,
                scale: isIntro ? scale : 1,
                transformPerspective: '1000px',
                transformOrigin: 'top center'
            }}
        >
            {/* Cabinet Frame/Rails */}
            <div className="cabinet-rail-left" style={{
                position: 'absolute',
                left: '10%',
                top: 0,
                bottom: 0,
                width: '20px',
                background: 'linear-gradient(90deg, #444, #666, #444)', // Darker metal rails
                zIndex: 0,
                boxShadow: 'inset 0 0 5px rgba(0,0,0,0.5)'
            }} />
            <div className="cabinet-rail-right" style={{
                position: 'absolute',
                right: '10%',
                top: 0,
                bottom: 0,
                width: '20px',
                background: 'linear-gradient(90deg, #444, #666, #444)', // Darker metal rails
                zIndex: 0,
                boxShadow: 'inset 0 0 5px rgba(0,0,0,0.5)'
            }} />

            <motion.div
                className="folder-stack"
                style={{
                    width: '100%',
                    maxWidth: '800px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    perspective: '1000px',
                    zIndex: 1
                }}
            >
                <h1 style={{
                    color: 'rgba(255,255,255,0.1)',
                    fontFamily: 'var(--font-primary)',
                    fontSize: '4rem',
                    marginBottom: '2rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.2em'
                }}>
                    Archives
                </h1>

                {files.map((file, index) => (
                    <FileFolder
                        key={file.id}
                        {...file}
                        index={index}
                        total={files.length}
                        onSelect={onOpenFile}
                        mouseX={mousePos.x}
                        mouseY={mousePos.y}
                    />
                ))}
            </motion.div>
        </motion.div>
    );
};

export default FileCabinet;
