import { Nav } from "@/components/nav";
import { Hero } from "@/components/hero";
import { FeatureCards } from "@/components/feature-cards";
import { CodeExamples } from "@/components/code-examples";
import { FeaturesList } from "@/components/features-list";
import { WavePattern } from "@/components/wave-pattern";

export default async function Home() {
  return (
    <div className="relative min-h-screen">
      <WavePattern />
      <Nav />
      <Hero />
      <FeatureCards />
      <hr className="mx-auto max-w-4xl border-border" />
      <CodeExamples />
      <hr className="mx-auto max-w-4xl border-border" />
      <FeaturesList />
    </div>
  );
}
