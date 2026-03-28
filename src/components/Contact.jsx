import { motion } from 'framer-motion'
import './Contact.css'

const Contact = () => {
  const socialLinks = [
    { name: 'Email', url: 'mailto:clavin@gatech.edu', icon: '✉' },
    { name: 'LinkedIn', url: 'https://linkedin.com/in/calvinhou', icon: '💼' },
    { name: 'GitHub', url: 'https://github.com/calvinhou', icon: '⚡' },
    { name: 'Instagram', url: 'https://instagram.com/calvinhou', icon: '📷' },
  ]

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  }

  return (
    <section id="contact" className="contact section page-section">
      <div className="container">
        <motion.h2
          className="section-title"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          Where to Find Me
        </motion.h2>
        <motion.div
          className="contact-content"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          <motion.p
            variants={itemVariants}
            className="contact-description"
          >
            Interested in collaborating on a robotics project, hardware design, or just want to chat
            about electrical engineering? Feel free to reach out through any of these platforms.
          </motion.p>
          <div className="social-links-grid">
            {socialLinks.map((link) => (
              <motion.a
                key={link.name}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="social-link aluminum"
                variants={itemVariants}
                whileHover={{ scale: 1.05, y: -5 }}
                whileTap={{ scale: 0.95 }}
              >
                <span className="social-icon">{link.icon}</span>
                <span className="social-name">{link.name}</span>
              </motion.a>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}

export default Contact


