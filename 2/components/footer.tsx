import Image from "next/image"

export function Footer() {
  return (
    <footer className="py-16 border-t border-border">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <Image
            src="/images/e3-83-ad-e3-82-b42-20-281-29.png"
            alt="jaila"
            width={120}
            height={48}
            className="h-12 w-auto"
          />

          <nav className="flex flex-wrap items-center justify-center gap-8">
            <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              ホーム
            </a>
            <a href="#services" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              サービス
            </a>
            <a href="#about" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              私たちについて
            </a>
            <a href="#contact" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              お問い合わせ
            </a>
          </nav>

          <p className="text-sm text-muted-foreground">© 2025 jaila. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
