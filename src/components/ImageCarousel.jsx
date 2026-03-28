import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import './ImageCarousel.css'

const ImageCarousel = ({ images = [] }) => {
  const [currentIndex, setCurrentIndex] = useState(0)

  // Default placeholder images if none provided
  const defaultImages = [
    { id: 1, url: 'https://via.placeholder.com/800x600/FF6B35/FFFFFF?text=Project+1', alt: 'Project 1' },
    { id: 2, url: 'https://via.placeholder.com/800x600/000000/FFFFFF?text=Project+2', alt: 'Project 2' },
    { id: 3, url: 'https://via.placeholder.com/800x600/FF6B35/FFFFFF?text=Project+3', alt: 'Project 3' },
  ]

  const displayImages = images.length > 0 ? images : defaultImages

  const nextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % displayImages.length)
  }

  const prevImage = () => {
    setCurrentIndex((prev) => (prev - 1 + displayImages.length) % displayImages.length)
  }

  const goToImage = (index) => {
    setCurrentIndex(index)
  }

  return (
    <div className="image-carousel">
      <div className="carousel-container">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            className="carousel-image-wrapper"
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          >
            <img
              src={displayImages[currentIndex].url}
              alt={displayImages[currentIndex].alt}
              className="carousel-image"
            />
          </motion.div>
        </AnimatePresence>
        
        <button className="carousel-button carousel-button-prev" onClick={prevImage}>
          ←
        </button>
        <button className="carousel-button carousel-button-next" onClick={nextImage}>
          →
        </button>
      </div>
      
      <div className="carousel-indicators">
        {displayImages.map((_, index) => (
          <button
            key={index}
            className={`carousel-indicator ${index === currentIndex ? 'active' : ''}`}
            onClick={() => goToImage(index)}
            aria-label={`Go to image ${index + 1}`}
          />
        ))}
      </div>
    </div>
  )
}

export default ImageCarousel


