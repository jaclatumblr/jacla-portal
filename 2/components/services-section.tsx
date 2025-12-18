import { Sparkles, Palette, Heart, Star } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

const services = [
  {
    icon: Sparkles,
    title: "ブランディング",
    description: "あなたのビジョンを形にする、唯一無二のブランドアイデンティティを創造します。",
  },
  {
    icon: Palette,
    title: "デザイン",
    description: "美しさと機能性を兼ね備えた、心に残るデザインをお届けします。",
  },
  {
    icon: Heart,
    title: "コンサルティング",
    description: "お客様のニーズに寄り添い、最適なソリューションをご提案します。",
  },
  {
    icon: Star,
    title: "プロデュース",
    description: "コンセプトから実現まで、トータルでサポートいたします。",
  },
]

export function ServicesSection() {
  return (
    <section id="services" className="py-24 md:py-32 bg-muted/30">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-sm uppercase tracking-[0.3em] text-secondary-foreground mb-4">Services</p>
          <h2 className="text-3xl md:text-5xl font-light text-foreground mb-6 text-balance">私たちのサービス</h2>
          <div className="w-24 h-0.5 bg-primary mx-auto" />
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {services.map((service, index) => (
            <Card
              key={index}
              className="group bg-card border-border hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5"
            >
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6 group-hover:bg-primary/20 transition-colors">
                  <service.icon className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-medium text-foreground mb-4">{service.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{service.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
