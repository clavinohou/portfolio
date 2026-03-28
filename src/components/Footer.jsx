import './Footer.css'

const Footer = () => {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-content">
          <p>© {currentYear} Calvin Hou. All rights reserved.</p>
          <p className="footer-domain">calvinhou.com</p>
        </div>
      </div>
    </footer>
  )
}

export default Footer


