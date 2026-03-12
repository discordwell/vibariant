import BifurcationBackground from "@/components/landing/BifurcationBackground";
import LandingNav from "@/components/landing/LandingNav";
import HeroSection from "@/components/landing/HeroSection";
import FeaturesSection from "@/components/landing/FeaturesSection";
import DemoSection from "@/components/landing/DemoSection";
import PricingSection from "@/components/landing/PricingSection";
import FooterSection from "@/components/landing/FooterSection";
import VibariantWrapper from "@/components/landing/VibariantWrapper";

export default function HomePage() {
  return (
    <VibariantWrapper>
      <BifurcationBackground />
      <LandingNav />
      <main>
        <HeroSection />
        <FeaturesSection />
        <DemoSection />
        <PricingSection />
      </main>
      <FooterSection />
    </VibariantWrapper>
  );
}
