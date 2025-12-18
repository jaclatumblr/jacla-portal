import Image from "next/image"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Gold circles */}
        <div className="absolute top-32 left-16 w-20 h-20 rounded-full bg-secondary/40" />
        <div className="absolute top-48 right-24 w-8 h-8 rounded-full bg-secondary/60" />
        <div className="absolute bottom-40 left-1/4 w-6 h-6 rounded-full bg-secondary/50" />
        <div className="absolute bottom-60 right-1/3 w-12 h-12 rounded-full bg-secondary/30" />

        {/* Decorative lines */}
        <div className="absolute top-1/3 left-0 w-32 h-0.5 bg-primary/20 rotate-12" />
        <div className="absolute top-1/3 left-8 w-48 h-0.5 bg-secondary/30 rotate-12" />
        <div className="absolute bottom-1/3 right-0 w-40 h-0.5 bg-primary/20 -rotate-12" />
        <div className="absolute bottom-1/3 right-12 w-32 h-0.5 bg-secondary/30 -rotate-12" />
      </div>

      <div className="max-w-7xl mx-auto px-6 py-20 text-center relative z-10">
        <div className="mb-12">
          <Image
            src="/images/e3-83-ad-e3-82-b42-20-281-29.png"
            alt="jaila"
            width={400}
            height={160}
            className="mx-auto h-32 md:h-48 w-auto"
            priority
          />
        </div>

        <h1 className="text-4xl md:text-6xl lg:text-7xl font-light tracking-tight text-foreground mb-6 text-balance">
          <span className="block">洗練されたデザインと</span>
          <span className="block text-primary">美しさの融合</span>
        </h1>

        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-12 leading-relaxed">
          エレガンスを追求し、細部にまでこだわった
          <br className="hidden md:block" />
          あなただけの特別な体験をお届けします
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            size="lg"
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-6 text-base rounded-full"
          >
            詳しく見る
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="border-secondary text-secondary-foreground hover:bg-secondary/10 px-8 py-6 text-base rounded-full bg-transparent"
          >
            お問い合わせ
          </Button>
        </div>
      </div>
    </section>
  )
}
