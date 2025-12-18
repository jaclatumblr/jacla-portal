"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Menu, Calendar, Music, Lightbulb, Users, User, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

export function MobileNav() {
  const [open, setOpen] = useState(false)

  const navItems = [
    { href: "/", label: "ホーム", icon: null },
    { href: "/events", label: "イベント管理", icon: Calendar },
    { href: "/pa", label: "PA機材管理", icon: Music },
    { href: "/lighting", label: "照明機材管理", icon: Lightbulb },
    { href: "/members", label: "メンバー一覧", icon: Users },
    { href: "/me/profile", label: "マイプロフィール", icon: User },
  ]

  return (
    <header className="border-b border-border bg-card sticky top-0 z-50 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/images/e3-83-ad-e3-82-b42-20-281-29.png"
              alt="jacla logo"
              width={80}
              height={48}
              className="object-contain"
            />
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold text-foreground">総合音楽部 jacla</h1>
              <p className="text-xs text-muted-foreground">部員ポータル</p>
            </div>
          </Link>

          {/* Hamburger Menu */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-6 w-6" />
                <span className="sr-only">メニューを開く</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[400px]">
              <div className="flex flex-col h-full">
                {/* Header in menu */}
                <div className="flex items-center gap-2 pb-6 border-b border-border">
                  <Image
                    src="/images/e3-83-ad-e3-82-b42-20-281-29.png"
                    alt="jacla logo"
                    width={60}
                    height={36}
                    className="object-contain"
                  />
                  <div>
                    <h2 className="text-base font-bold text-foreground">総合音楽部 jacla</h2>
                    <p className="text-xs text-muted-foreground">部員ポータル</p>
                  </div>
                </div>

                {/* Navigation Links */}
                <nav className="flex-1 py-6">
                  <ul className="space-y-2">
                    {navItems.map((item) => {
                      const Icon = item.icon
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={() => setOpen(false)}
                            className="flex items-center gap-3 px-4 py-3 rounded-lg text-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                          >
                            {Icon && <Icon className="h-5 w-5" />}
                            <span className="font-medium">{item.label}</span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </nav>

                {/* Logout Button */}
                <div className="pt-6 border-t border-border">
                  <Button variant="outline" className="w-full justify-start gap-2 bg-transparent" size="lg">
                    <LogOut className="h-5 w-5" />
                    ログアウト
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.slice(1).map((item) => {
              const Icon = item.icon
              return (
                <Link key={item.href} href={item.href}>
                  <Button variant="ghost" size="sm" className="gap-2">
                    {Icon && <Icon className="h-4 w-4" />}
                    {item.label}
                  </Button>
                </Link>
              )
            })}
            <Button variant="outline" size="sm" className="ml-2 bg-transparent">
              ログアウト
            </Button>
          </nav>
        </div>
      </div>
    </header>
  )
}
