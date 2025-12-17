export function AboutSection() {
  return (
    <section id="about" className="py-24 md:py-32 relative overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute top-20 right-10 w-32 h-32 rounded-full bg-secondary/20" />
      <div className="absolute bottom-20 left-10 w-24 h-24 rounded-full bg-primary/10" />

      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-secondary-foreground mb-4">About Us</p>
            <h2 className="text-3xl md:text-5xl font-light text-foreground mb-8 text-balance">
              エレガンスを
              <span className="text-primary block">追求する</span>
            </h2>
            <div className="space-y-6 text-muted-foreground leading-relaxed">
              <p>
                jailaは、美しさと機能性の完璧なバランスを追求するクリエイティブスタジオです。
                私たちは、お客様一人ひとりの想いに耳を傾け、その想いを形にすることを大切にしています。
              </p>
              <p>
                細部へのこだわりと、時代を超えて愛されるデザインを心がけ、
                お客様の期待を超える体験をお届けすることをお約束します。
              </p>
            </div>

            <div className="flex gap-12 mt-12">
              <div>
                <p className="text-4xl font-light text-primary">10+</p>
                <p className="text-sm text-muted-foreground mt-2">年の実績</p>
              </div>
              <div>
                <p className="text-4xl font-light text-primary">500+</p>
                <p className="text-sm text-muted-foreground mt-2">プロジェクト</p>
              </div>
              <div>
                <p className="text-4xl font-light text-primary">100%</p>
                <p className="text-sm text-muted-foreground mt-2">満足度</p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="aspect-[4/5] bg-muted rounded-2xl overflow-hidden relative">
              <img src="/elegant-minimalist-studio-interior-with-pink-and-g.jpg" alt="jailaスタジオ" className="w-full h-full object-cover" />
              {/* Overlay accent */}
              <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-primary/20 to-transparent" />
            </div>
            {/* Floating accent */}
            <div className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full bg-secondary/30 -z-10" />
            <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-primary/20 -z-10" />
          </div>
        </div>
      </div>
    </section>
  )
}
