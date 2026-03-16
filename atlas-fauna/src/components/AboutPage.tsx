import aboutHeroImage from '../assets/about.png';
import founderImage from '../assets/team/founder.jpg';
import developerImage from '../assets/team/razrab.jpg';

interface AboutPageProps {
  onBackHome: () => void;
  onOpenMap: () => void;
}

const featureCards = [
  {
    icon: '3d_rotation',
    title: 'Интерактивность',
    description:
      'Погружение в мир дикой природы через взаимодействие с детальными 3D-моделями животных прямо в браузере. Исследуйте анатомию и повадки без границ.'
  },
  {
    icon: 'menu_book',
    title: 'Образование',
    description:
      'Обширная база данных редких видов с подробной информацией об их ареалах обитания, статусе популяции и уникальных особенностях.'
  },
  {
    icon: 'shield',
    title: 'Сохранение',
    description:
      'Мы привлекаем внимание к проблемам экологии, наглядно показывая хрупкость экосистем и необходимость защиты исчезающих видов региона.'
  }
];

const technologies = [
  { icon: 'public', title: 'Яндекс Карты', subtitle: 'Интеграция географических данных' },
  { icon: 'view_in_ar', title: 'WebGL и Three.js', subtitle: 'Визуализация сцены' },
  { icon: 'memory', title: 'Node.js + Express', subtitle: 'Серверная часть и обработка данных' },
  { icon: 'dns', title: 'PostgreSQL', subtitle: 'Надежное хранение информации' },
  { icon: 'code', title: 'React + TypeScript + Vite', subtitle: 'Современная архитектура интерфейса' },
  { icon: 'layers', title: '3D-ассеты (GLB)', subtitle: 'Оптимизированные 3D-модели' }
];

const team = [
  {
    name: 'Елена Абарникова',
    role: 'Founder и куратор проекта',
    focus:
      'Концептуальное руководство проектом: оценка научно-образовательного потенциала материалов и проектирование логической архитектуры атласа как прикладного инструмента для исследования региональной фауны.',
    avatar: founderImage,
    imagePosition: 'center 24%'
  },
  {
    name: 'Дмитрий Филиппов',
    role: 'Frontend / Backend / 3D-интеграция',
    focus:
      'Техническое обеспечение платформы: проектирование пользовательского интерфейса и интерактивной карты, внедрение трехмерных моделей, настройка серверной части и поддержание бесперебойной работы базовых функций системы.',
    avatar: developerImage,
    imagePosition: 'center 18%'
  }
];

export default function AboutPage({ onBackHome, onOpenMap }: AboutPageProps) {
  return (
    <section className="about-page-screen">
      <header className="about-page-header">
        <div className="about-page-breadcrumbs">
          <button type="button" className="about-page-breadcrumb-link" onClick={onBackHome}>
            Главная
          </button>
        </div>

        <div className="about-page-header-right">
          <nav className="about-page-nav">
            <button type="button" className="about-page-nav-link" onClick={onOpenMap}>
              Карта
            </button>
            <span className="about-page-nav-current">О проекте</span>
          </nav>
        </div>
      </header>

      <main className="about-page-main">
        <section
          className="about-page-hero"
          style={{
            backgroundImage: `linear-gradient(180deg, rgba(12, 26, 18, 0.64), rgba(12, 26, 18, 0.76)), url(${aboutHeroImage})`
          }}
        >
          <div className="about-page-container about-page-hero-inner">
            <div className="about-page-chip">
              <span className="material-icons" aria-hidden>
                public
              </span>
              <span>Атлас Фауны</span>
            </div>
            <h1>
              О проекте: <span>Атлас фауны</span> Дальнего Востока
            </h1>
            <p>
              Наша цель - улучшение доступности и качества образовательного контента о животном мире региона для аудитории путем
              агрегации данных в единой интерактивной среде.
            </p>
          </div>
        </section>

        <section className="about-page-features">
          <div className="about-page-container about-page-feature-grid">
            {featureCards.map((item) => (
              <article key={item.title} className="about-page-feature-card">
                <div className="about-page-feature-icon">
                  <span className="material-icons" aria-hidden>
                    {item.icon}
                  </span>
                </div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="about-page-tech">
          <div className="about-page-container about-page-tech-grid">
            <div className="about-page-tech-list-wrap">
              <h2>Используемые технологии</h2>
              <p>
                Для реализации проекта мы используем современный стек веб-технологий, который
                обеспечивает высокую производительность и интерактивность.
              </p>
              <ul className="about-page-tech-list">
                {technologies.map((item) => (
                  <li key={item.title} className="about-page-tech-item">
                    <div className="about-page-tech-icon">
                      <span className="material-icons" aria-hidden>
                        {item.icon}
                      </span>
                    </div>
                    <div>
                      <strong>{item.title}</strong>
                      <span>{item.subtitle}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="about-page-code-card">
              <div className="about-page-code-header">
                <div className="about-page-code-dots" aria-hidden>
                  <span />
                  <span />
                  <span />
                </div>
                <span className="about-page-code-file">api/fauna_controller.ts</span>
              </div>

              <div className="about-page-code-body">
                <code>
                  <span className="about-page-code-comment">{'// Контроллер API фауны'}</span>
                  <span>{'export const getAnimalData = async (req, res) => {'}</span>
                  <span>{'  const { id } = req.params;'}</span>
                  <span />
                  <span className="about-page-code-comment">{'  // Получение данных из защищённой базы данных'}</span>
                  <span>{'  const animal = await db.query('}</span>
                  <span className="about-page-code-string">{'    "SELECT * FROM species WHERE id = $1", [id]'}</span>
                  <span>{'  );'}</span>
                  <span />
                  <span>{'  return res.json({'}</span>
                  <span className="about-page-code-string">{'    model: `/assets/3d/${animal.slug}.glb`,'}</span>
                  <span>{'    stats: animal.data'}</span>
                  <span>{'  });'}</span>
                  <span>{'};'}</span>
                  <span className="about-page-cursor" aria-hidden />
                </code>
              </div>

              <div className="about-page-code-footer">
                <span className="about-page-code-status">
                  <span className="material-icons" aria-hidden>
                    check_circle
                  </span>
                  Status: Compiled Successfully
                </span>
                <span>Ln 12, Col 4</span>
              </div>
            </div>
          </div>
        </section>

        <section className="about-page-team">
          <div className="about-page-team-pattern" />
          <div className="about-page-container about-page-team-inner">
            <span className="about-page-team-chip">Команда проекта</span>
            <h2>Команда проекта</h2>
            <p>
              Команда объединяет предметную экспертизу и техническую реализацию: founder задаёт концепцию и образовательный вектор, а разработчик превращает идею в интерактивный веб-сервис.
            </p>

            <div className="about-page-team-grid">
              {team.map((member) => (
                <article key={member.name} className="about-page-team-card">
                  <div className="about-page-team-avatar">
                    <img
                      src={member.avatar}
                      alt={member.name}
                      loading="lazy"
                      style={member.imagePosition ? { objectPosition: member.imagePosition } : undefined}
                    />
                  </div>
                  <div>
                    <h4>{member.name}</h4>
                    <span>{member.role}</span>
                    <p>{member.focus}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

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
    </section>
  );
}
