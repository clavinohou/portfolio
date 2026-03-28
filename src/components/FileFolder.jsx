import { motion } from 'framer-motion';

const FileFolder = ({ id, label, color, index, total, onSelect, mouseX, mouseY }) => {
    // Calculate offset based on mouse position for the "flipping" effect
    // This is a simplified version; in a real app we'd use useTransform from framer-motion
    // but passing raw mouse coordinates allows for more complex custom logic if needed.

    return (
        <motion.div
            className="file-folder"
            onClick={() => onSelect(id)}
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: index * 0.1, type: 'spring' }}
            whileHover={{ y: -20, scale: 1.02, zIndex: 10 }}
            style={{
                position: 'relative',
                width: '100%',
                maxWidth: '800px',
                height: '60px', // Visible height of the tab/spine
                backgroundColor: color || 'var(--color-folder-tab)',
                marginBottom: '-40px', // Overlap to look like a stack
                borderRadius: '8px 8px 0 0',
                boxShadow: '0 -2px 10px rgba(0,0,0,0.1)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '0 2rem',
                transformOrigin: 'bottom center',
                borderTop: '1px solid rgba(255,255,255,0.3)',
                zIndex: index,
            }}
        >
            <div className="folder-tab-content" style={{
                display: 'flex',
                justifyContent: 'space-between',
                width: '100%',
                alignItems: 'center'
            }}>
                <h3 style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '1.2rem',
                    fontWeight: 600,
                    color: '#333',
                    margin: 0
                }}>
                    {label}
                </h3>
                <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.9rem',
                    opacity: 0.6
                }}>
                    FILE_0{index + 1}
                </span>
            </div>
        </motion.div>
    );
};

export default FileFolder;
