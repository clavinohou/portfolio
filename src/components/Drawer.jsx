import { motion } from 'framer-motion';
import '../styles/global.css';

const Drawer = ({ dragY, children }) => {
    // Dimensions
    const width = 340;
    const height = 400; // Front face height
    const depth = 500; // How deep the drawer is
    const wallThickness = 2;

    return (
        <motion.div
            className="drawer-assembly object-3d"
            style={{
                width: width,
                height: height,
                y: dragY, // In 2D view this moves down, we'll map it to Z in parent if needed
                // But for "Pulling Out", moving Y down on screen looks like pulling towards you
                // if the camera is angled right. 
                // Let's stick to the plan: Drag Y (screen) -> Translate Z (world)
                // Wait, Framer drag is 2D. We'll use the parent to map this.
            }}
        >
            {/* FRONT FACE (The one with the handle) */}
            <div className="face front aluminum-texture" style={{
                width: width,
                height: height,
                transform: `translateZ(${depth / 2}px)`,
                backgroundColor: '#FFFFFF',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                paddingTop: '60px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
            }}>
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
                        fontFamily: 'var(--font-sans)',
                        color: '#FF6B35',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        letterSpacing: '0.1em'
                    }}>
                        PORTFOLIO
                    </span>
                </div>

                {/* Handle Visual */}
                <div style={{
                    width: '160px',
                    height: '30px',
                    background: 'linear-gradient(180deg, #f5f5f5 0%, #d4d4d4 100%)',
                    borderRadius: '4px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <div style={{ width: '80%', height: '2px', backgroundColor: 'rgba(0,0,0,0.1)', marginBottom: '2px' }} />
                    <div style={{ width: '80%', height: '2px', backgroundColor: 'rgba(0,0,0,0.1)' }} />
                </div>
            </div>

            {/* BOTTOM FACE */}
            <div className="face bottom" style={{
                width: width,
                height: depth,
                backgroundColor: '#a0a0a0',
                transform: `rotateX(-90deg) translateZ(${height / 2}px)`,
            }} />

            {/* LEFT FACE */}
            <div className="face left" style={{
                width: depth,
                height: height,
                backgroundColor: '#d0d0d0',
                transform: `rotateY(-90deg) translateZ(${width / 2}px)`,
            }} />

            {/* RIGHT FACE */}
            <div className="face right" style={{
                width: depth,
                height: height,
                backgroundColor: '#c0c0c0', // Slightly darker for faux shading
                transform: `rotateY(90deg) translateZ(${width / 2}px)`,
            }} />

            {/* BACK FACE */}
            <div className="face back" style={{
                width: width,
                height: height,
                backgroundColor: '#b0b0b0',
                transform: `rotateY(180deg) translateZ(${depth / 2}px)`,
            }} />

            {/* CONTENTS CONTAINER */}
            <div className="drawer-contents object-3d" style={{
                width: width,
                height: depth,
                transform: `rotateX(-90deg) translateZ(${height / 2 - 20}px)`, // Sit on bottom
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '20px'
            }}>
                {children}
            </div>

        </motion.div>
    );
};

export default Drawer;
