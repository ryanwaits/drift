import { FeatureRows } from '@/components/feature-rows';
import { Footer } from '@/components/footer';
import { Hero } from '@/components/hero';
import { Nav } from '@/components/nav';
import { WavePattern } from '@/components/wave-pattern';

export default function Home() {
  return (
    <div className="relative min-h-screen">
      <Nav />
      <div className="relative overflow-hidden">
        <WavePattern />
        <Hero />
      </div>
      <hr className="section-divider" />
      <FeatureRows />
      <hr className="section-divider" />
      <Footer />
    </div>
  );
}
