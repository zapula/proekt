// src/ProfileModal.tsx
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { User } from './types';
import { apiUrl } from './utils/api';
import { createAuthHeaders } from './utils/auth';
import './App.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  // Оставляем для совместимости с App.tsx, но данные теперь грузим с сервера
  allAnimals?: any[]; 
  // НОВОЕ: Функция для скролла к животному на карте
  onNavigateToAnimal: (locationId: number) => void; 
}

type Tab = 'collection' | 'achievements' | 'leaderboard';

export default function ProfileModal({ isOpen, onClose, user, onNavigateToAnimal }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('collection');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'mammal' | 'bird'>('all');

  // Загрузка полных данных профиля (Коллекция + Ачивки + Рейтинг)
  useEffect(() => {
    if (isOpen && user) {
      setLoading(true);
      // Передаем email, чтобы сервер мог найти "мое место" в рейтинге
      fetch(apiUrl('/api/profile-full'), {
        headers: createAuthHeaders(),
        credentials: 'include'
      })
        .then(res => res.json())
        .then(serverData => {
          setData(serverData);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  // --- ЛОГИКА ОТОБРАЖЕНИЯ (Только если данные загрузились) ---
  
  // 1. Круговая диаграмма CSS (conic-gradient)
  // Вычисляем процент собранных уникальных видов
  const totalSpecies = data?.collection?.length || 0;
  const uniqueUnlocked = data?.stats?.uniqueGrown || 0;
  const collectionPercent = totalSpecies > 0 ? Math.round((uniqueUnlocked / totalSpecies) * 100) : 0;
  
  const pieStyle = {
    background: `conic-gradient(#4caf50 ${collectionPercent}%, #eee ${collectionPercent}% 100%)`
  };

  // 2. Фильтрация и сортировка коллекции
  // Сортируем: Сначала "Золотые" (много раз), потом начатые, в конце не открытые
  const filteredCollection = data?.collection
    ? data.collection
        .filter((item: any) => filter === 'all' || item.category === filter)
        .sort((a: any, b: any) => b.times - a.times)
    : [];

  // 3. Любимое животное (максимум выращиваний)
  const favorite = data?.collection.reduce((prev: any, current: any) => (prev.times > current.times) ? prev : current, { times: 0, name: 'Нет' });

  // 4. Ранг (Берем из stats или считаем на лету)
  const rankName = 
      data?.stats?.rank === 1 ? '🥇 Чемпион' :
      data?.stats?.totalGrown > 20 ? 'Хранитель леса' :
      data?.stats?.totalGrown > 10 ? 'Егерь' :
      data?.stats?.totalGrown > 3 ? 'Исследователь' : 'Начинающий';

  // Обработчик клика по фону (Закрытие)
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const content = (
    <div className="auth-overlay" onMouseDown={handleOverlayClick}>
      <div className="auth-window profile-window" style={{ maxWidth: 550, padding: 0, overflow: 'hidden', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        
        {/* КНОПКА ЗАКРЫТИЯ */}
        <button className="close-btn" onClick={onClose} style={{ top: 10, right: 10, position: 'absolute', zIndex: 10 }}>×</button>

        {loading || !data ? (
          <div style={{ padding: 40, textAlign: 'center' }}>Загрузка профиля...</div>
        ) : (
          <>
            {/* ШАПКА ПРОФИЛЯ */}
            <div style={{ background: '#f5f5f5', padding: '20px', borderBottom: '1px solid #ddd' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
                <div style={{ fontSize: 40 }}>👤</div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 18 }}>{user.email}</h2>
                  <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                    📍 Глобальный рейтинг: <b>#{data.stats.rank > 0 ? data.stats.rank : '-'}</b> • Звание: <b>{rankName}</b>
                  </div>
                </div>
              </div>

              {/* СЕТКА СТАТИСТИКИ */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 15, fontSize: 12 }}>
                <div className="stat-box">🌟 Видов: {uniqueUnlocked}/{totalSpecies} ({collectionPercent}%)</div>
                <div className="stat-box">🔁 Всего выращено: {data.stats.totalGrown}</div>
                <div className="stat-box">🏆 Ачивок: {data.stats.totalAchievements}/{data.stats.maxAchievements}</div>
                <div className="stat-box">💚 Любимец: {favorite.times > 0 ? `${favorite.name}` : '-'}</div>
              </div>
            </div>

            {/* ВКЛАДКИ */}
            <div className="auth-tabs" style={{ margin: 0, borderRadius: 0, borderBottom: '1px solid #eee', background: 'white' }}>
              <button className={`auth-tab ${activeTab === 'collection' ? 'active' : ''}`} onClick={() => setActiveTab('collection')}>📚 Коллекция</button>
              <button className={`auth-tab ${activeTab === 'achievements' ? 'active' : ''}`} onClick={() => setActiveTab('achievements')}>🏆 Достижения</button>
              <button className={`auth-tab ${activeTab === 'leaderboard' ? 'active' : ''}`} onClick={() => setActiveTab('leaderboard')}>📊 Рейтинг</button>
            </div>

            {/* КОНТЕНТ ВКЛАДОК (Скроллируемый) */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '15px', background: '#fff' }}>
              
              {/* === ВКЛАДКА 1: КОЛЛЕКЦИЯ === */}
              {activeTab === 'collection' && (
                <div>
                  {/* Блок диаграммы и фильтров */}
                  <div style={{ display: 'flex', gap: 15, marginBottom: 15, alignItems: 'center' }}>
                    <div className="pie-chart" style={pieStyle}>
                      <div className="pie-inner">{collectionPercent}%</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 5 }}>
                        {['all', 'mammal', 'bird'].map(f => (
                          <button 
                            key={f} 
                            onClick={() => setFilter(f as any)}
                            style={{ 
                              padding: '4px 10px', borderRadius: 12, border: '1px solid #ccc',
                              background: filter === f ? '#333' : '#fff',
                              color: filter === f ? '#fff' : '#333',
                              cursor: 'pointer', fontSize: 11
                            }}
                          >
                            {f === 'all' ? 'Все' : f === 'mammal' ? 'Звери' : 'Птицы'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Список животных */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {filteredCollection.map((item: any) => {
                      const started = item.satiety > 0 || item.times > 0;
                      const completed = item.times > 0;
                      
                      return (
                        <div 
                          key={item.location_id} 
                          onClick={() => { onClose(); onNavigateToAnimal(item.location_id); }}
                          style={{ 
                            display: 'flex', alignItems: 'center', padding: '8px 12px', 
                            background: completed ? '#e8f5e9' : (started ? '#fff3e0' : '#f5f5f5'),
                            border: '1px solid #eee', borderRadius: 8, cursor: 'pointer',
                            opacity: started ? 1 : 0.7,
                            transition: 'transform 0.1s'
                          }}
                          className="collection-row"
                        >
                          <div style={{ fontSize: 20, width: 30 }}>{completed ? '✅' : (started ? '⭐' : '⚪')}</div>
                          <img src={`/icons/${item.icon_file}`} style={{ width: 30, height: 30, marginRight: 10, filter: started ? 'none' : 'grayscale(100%)' }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 'bold', fontSize: 13 }}>{item.name}</div>
                            {started && !completed && (
                              <div style={{ width: 60, height: 4, background: '#eee', borderRadius: 2, marginTop: 4 }}>
                                <div style={{ width: `${item.satiety}%`, height: '100%', background: 'orange', borderRadius: 2 }} />
                              </div>
                            )}
                            {!started && <div style={{ fontSize: 10, color: '#999' }}>Не начато</div>}
                          </div>
                          
                          {completed && (
                            <div style={{ fontWeight: 'bold', fontSize: 12, color: item.times >= 10 ? '#9c27b0' : (item.times >= 5 ? '#1976d2' : '#4caf50') }}>
                              {item.times >= 10 ? '🥇' : (item.times >= 5 ? '🥈' : '🥉')} x{item.times}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* === ВКЛАДКА 2: ДОСТИЖЕНИЯ === */}
              {activeTab === 'achievements' && (
                <div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {data.achievements.map((ach: any) => (
                      <div key={ach.code} style={{ 
                        border: ach.unlocked ? '2px solid #ffd700' : '1px solid #eee',
                        background: ach.unlocked ? '#fffde7' : '#fafafa',
                        padding: 10, borderRadius: 8, position: 'relative'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                          <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>{ach.unlocked ? '🎉' : '🔒'} {ach.icon} {ach.title}</span>
                          </div>
                          {ach.unlocked && <div style={{ fontSize: 10, color: '#888' }}>{new Date(ach.unlocked_at).toLocaleDateString()}</div>}
                        </div>
                        <div style={{ fontSize: 12, color: '#555', marginBottom: 8 }}>{ach.desc}</div>
                        
                        {/* Прогресс бар ачивки */}
                        <div style={{ height: 6, background: '#eee', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ 
                            width: `${Math.min(100, (ach.current / ach.threshold) * 100)}%`, 
                            height: '100%', 
                            background: ach.unlocked ? '#4caf50' : '#2196f3',
                            transition: 'width 0.5s'
                          }} />
                        </div>
                        <div style={{ fontSize: 10, textAlign: 'right', marginTop: 2, color: '#777' }}>
                          {ach.current} / {ach.threshold}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* === ВКЛАДКА 3: РЕЙТИНГ === */}
              {activeTab === 'leaderboard' && (
                <div>
                  <div style={{ background: '#e3f2fd', padding: 10, borderRadius: 8, marginBottom: 15, fontSize: 12, color: '#0d47a1' }}>
                    Таблица обновляется в реальном времени. <br/>
                    Рейтинг строится по количеству <b>уникальных видов</b>, а затем по общему числу.
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #eee', color: '#888' }}>
                        <th style={{ textAlign: 'left', padding: '8px 5px' }}>#</th>
                        <th style={{ textAlign: 'left', padding: '8px 5px' }}>Игрок</th>
                        <th style={{ textAlign: 'center', padding: '8px 5px' }}>Виды</th>
                        <th style={{ textAlign: 'right', padding: '8px 5px' }}>Всего</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.leaderboard.map((player: any, index: number) => {
                        const isMe = Boolean(player.is_current_user);
                        return (
                          <tr key={index} style={{ 
                            background: isMe ? '#fff9c4' : (index % 2 === 0 ? '#fff' : '#f9f9f9'),
                            fontWeight: isMe ? 'bold' : 'normal',
                            borderBottom: '1px solid #f0f0f0'
                          }}>
                            <td style={{ padding: '10px 5px' }}>
                              {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                            </td>
                            <td style={{ padding: '10px 5px' }}>
                              {String(player.display_name || 'Игрок')} {isMe && '(Вы)'}
                            </td>
                            <td style={{ padding: '10px 5px', textAlign: 'center' }}>
                              <span style={{background: '#e8f5e9', color: '#2e7d32', padding: '2px 6px', borderRadius: 4}}>{player.unique_species}</span>
                            </td>
                            <td style={{ padding: '10px 5px', textAlign: 'right', color: '#666' }}>{player.total_grown}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

            </div>
          </>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
