import Header from '@/components/site/Header';
import Hero from '@/components/site/Hero';
import HowItWorks from '@/components/site/HowItWorks';
import Cities from '@/components/site/Cities';
import Pricing from '@/components/site/Pricing';
import PostForm from '@/components/site/PostForm';
import Footer from '@/components/site/Footer';
import useHeartbeat from '@/hooks/useHeartbeat';

const Index = () => {
  useHeartbeat();

  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <Hero />
        <HowItWorks />
        <Cities />
        <Pricing />
        <PostForm />
      </main>
      <Footer />
    </div>
  );
};

export default Index;