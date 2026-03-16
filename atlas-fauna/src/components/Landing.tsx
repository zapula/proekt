import { useEffect, useRef, useState, type RefObject } from 'react';
import heroBackground from '../assets/hero.jpg';

interface LandingStat {
  label: string;
  value: number;
}

interface LandingFeaturedAnimal {
  id: number;
  locationId: number;
  name: string;
  isRedBook: boolean;
  image: string;
  fallbackIcon: string;
}

interface LandingArrows {
  canPrev: boolean;
  canNext: boolean;
}

interface AnimatedStatValueProps {
  value: number;
  shouldAnimate: boolean;
}

interface LandingProps {
  landingStats: LandingStat[];
  landingFeaturedAnimals: LandingFeaturedAnimal[];
  landingArrows: LandingArrows;
  landingCreaturesRef: RefObject<HTMLElement | null>;
  landingCardsRef: RefObject<HTMLDivElement | null>;
  onOpenAbout: () => void;
  onOpenRegionSelector: () => void;
  onScrollToCreatures: () => void;
  onScrollCards: (direction: 'prev' | 'next') => void;
  onOpenAnimal: (locationId: number) => void;
}

function AnimatedStatValue({ value, shouldAnimate }: AnimatedStatValueProps) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (!shouldAnimate || value <= 0) {
      setDisplayValue(0);
      return;
    }

    const durationMs = 1100;
    let rafId = 0;
    let startTime = 0;

    const tick = (timestamp: number) => {
      if (startTime === 0) {
        startTime = timestamp;
      }

      const progress = Math.min((timestamp - startTime) / durationMs, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const nextValue = Math.round(value * easedProgress);
      setDisplayValue(nextValue);

      if (progress < 1) {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [shouldAnimate, value]);

  return <span className="landing-v2-stat-value">{displayValue.toLocaleString('ru-RU')}</span>;
}

export default function Landing({
  landingStats,
  landingFeaturedAnimals,
  landingArrows,
  landingCreaturesRef,
  landingCardsRef,
  onOpenAbout,
  onOpenRegionSelector,
  onScrollToCreatures,
  onScrollCards,
  onOpenAnimal
}: LandingProps) {
  const statsRef = useRef<HTMLDivElement | null>(null);
  const [isStatsVisible, setIsStatsVisible] = useState(false);

  useEffect(() => {
    const statsElement = statsRef.current;
    if (!statsElement) return;

    if (typeof IntersectionObserver === 'undefined') {
      setIsStatsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting) {
          setIsStatsVisible(true);
          observer.disconnect();
        }
      },
      {
        threshold: 0.35
      }
    );

    observer.observe(statsElement);
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <section className="landing-v2-screen" style={{ backgroundColor: '#ffffff' }}>
      <div className="landing-v2-particle landing-v2-particle-mint" />
      <div className="landing-v2-particle landing-v2-particle-ice" />
      <div className="landing-v2-particle landing-v2-particle-primary" />

      <div className="landing-v2-shell">
        <nav className="landing-v2-nav">
          <div className="landing-v2-nav-brand">
            <span className="material-icons" aria-hidden>
              eco
            </span>
            <span>WildEcho</span>
          </div>
          <div className="landing-v2-nav-links">
            <button type="button" onClick={onOpenAbout}>
              О проекте
            </button>
          </div>
          <button type="button" className="landing-v2-nav-menu" aria-label="Открыть меню">
            <span className="material-icons" aria-hidden>
              menu
            </span>
          </button>
        </nav>

        <section className="landing-v2-hero">
          <div className="landing-v2-hero-left">
            <div className="landing-v2-line" />
            <span className="landing-v2-kicker">Интерактивная карта</span>
            <h2 className="landing-v2-title">
              Атлас фауны <br />
              <span>Дальнего Востока</span>
            </h2>
            <p className="landing-v2-subtitle">
              За пределами экрана. Испытайте дикую природу через наши иммерсивные карты. Слушайте эхо
              природы в ее чистейшем, нетронутом и первозданном виде.
            </p>
            <button type="button" className="landing-v2-main-btn landing-v2-main-btn-pulse" onClick={onOpenRegionSelector}>
              Начать исследование
              <span className="material-icons" aria-hidden>
                arrow_forward
              </span>
            </button>

            <div className="landing-v2-stats" ref={statsRef}>
              {landingStats.map((item) => (
                <div key={item.label} className="landing-v2-stat-item">
                  <AnimatedStatValue value={item.value} shouldAnimate={isStatsVisible} />
                  <span className="landing-v2-stat-label">{item.label}</span>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="landing-v2-scroll-indicator"
              onClick={onScrollToCreatures}
              aria-label="Прокрутить к обитателям"
            >
              <span className="material-icons" aria-hidden>
                arrow_downward
              </span>
            </button>
          </div>

          <aside className="landing-v2-hero-right">
            <img src={heroBackground} alt="Дальневосточная природа" loading="lazy" />
            <div className="landing-v2-hero-overlay" />
          </aside>
        </section>

        <section className="landing-v2-creatures" id="landing-creatures" ref={landingCreaturesRef}>
          <div className="landing-v2-creatures-head">
            <div>
              <span className="landing-v2-creatures-kicker">Обитатели</span>
              <h3>Познакомьтесь с обитателями атласа</h3>
            </div>
            <div className="landing-v2-creatures-arrows" aria-hidden={!landingArrows.canPrev && !landingArrows.canNext}>
              <button
                type="button"
                aria-label="Назад"
                onClick={() => onScrollCards('prev')}
                disabled={!landingArrows.canPrev}
                className={landingArrows.canPrev ? '' : 'is-placeholder'}
              >
                <span className="material-icons" aria-hidden>
                  arrow_back
                </span>
              </button>
              <button
                type="button"
                aria-label="Вперед"
                onClick={() => onScrollCards('next')}
                disabled={!landingArrows.canNext}
                className={landingArrows.canNext ? '' : 'is-placeholder'}
              >
                <span className="material-icons" aria-hidden>
                  arrow_forward
                </span>
              </button>
            </div>
          </div>

          <div className="landing-v2-cards" ref={landingCardsRef}>
            {landingFeaturedAnimals.length === 0 && (
              <div className="landing-v2-empty">Подборка формируется из актуальных видов карты...</div>
            )}

            {landingFeaturedAnimals.map((creature, index) => (
              <article key={`${creature.locationId}-${creature.id}-${index}`} className="landing-v2-card">
                <div className="landing-v2-card-image">
                  {creature.isRedBook && <span className="landing-v2-red-book-chip">Красная книга</span>}
                  <img
                    src={creature.image}
                    alt={creature.name}
                    loading="lazy"
                    onError={(event) => {
                      const img = event.currentTarget;
                      if (img.dataset.fallbackLoaded === 'true') return;
                      img.dataset.fallbackLoaded = 'true';
                      img.src = creature.fallbackIcon;
                    }}
                  />
                  <div className="landing-v2-card-overlay" />
                  <div className="landing-v2-card-content">
                    <h4>{creature.name}</h4>
                    <button
                      type="button"
                      className="landing-v2-card-btn"
                      onClick={() => onOpenAnimal(creature.locationId)}
                    >
                      Изучить в атласе
                      <span className="material-icons" aria-hidden>
                        arrow_forward
                      </span>
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <footer className="landing-v2-footer">
          <div className="landing-v2-footer-inner">
            <div className="landing-v2-footer-brand">
              <span className="material-icons" aria-hidden>
                eco
              </span>
              <div>
                <strong>WildEcho</strong>
                <span>Дальний Восток</span>
              </div>
            </div>
            <span>© {new Date().getFullYear()} Атлас Фауны Дальнего Востока, Дипломный проект КнАГУ</span>
          </div>
        </footer>
      </div>
    </section>
  );
}
