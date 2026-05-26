const fs = require('fs');
const file = 'src/components/LandingPage.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Fix the image URL extraction
const targetFetch = `imagem_url: post.mediaUrl || post.media_url || ''`;
const replacementFetch = `imagem_url: post.sizes?.large?.mediaUrl || post.sizes?.medium?.mediaUrl || post.thumbnailUrl || post.mediaUrl || post.media_url || ''`;
content = content.replace(targetFetch, replacementFetch);

// 2. Fix the Instagram card rendering
const targetCard = `                      <div className="instagram-card-image">
                        {item.imagem_url ? (
                          <img 
                            src={item.imagem_url} 
                            alt={item.titulo} 
                            className="instagram-image"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                              const parent = (e.target as HTMLElement).parentElement;
                              if (parent) {
                                parent.className = "instagram-card-image flex flex-col justify-center items-center p-8 bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] text-white w-full h-full";
                                parent.innerHTML = \`
                                  <svg class="w-12 h-12 mb-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                                  <span class="text-xs font-black uppercase tracking-widest text-center px-4">Ver publicação no Instagram</span>
                                \`;
                              }
                            }}
                          />
                        ) : (
                          <div className="flex flex-col justify-center items-center p-8 bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] text-white w-full h-full">
                            <svg className="w-12 h-12 mb-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                            <span className="text-xs font-black uppercase tracking-widest text-center px-4">Ver publicação no Instagram</span>
                          </div>
                        )}
                      </div>
                      <div className="instagram-card-actions">
                        <div className="instagram-actions-left">
                          <button className="instagram-action-btn heart" title="Curtir">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"/></svg>
                          </button>
                          <button className="instagram-action-btn" title="Comentar">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641l-.57 2.233 2.233-.57a1.8 1.8 0 011.641.586c1.457 1.414 3.376 2.273 5.48 2.273z"/></svg>
                          </button>
                          <button className="instagram-action-btn" title="Compartilhar">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/></svg>
                          </button>
                        </div>
                        <button className="instagram-action-btn" title="Salvar">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"/></svg>
                        </button>
                      </div>
                      <div className="instagram-card-body">
                        <span className="instagram-likes">Curtido por jbrautoria e outras pessoas</span>
                        <h3 className="hidden">{item.titulo}</h3>
                        <p className="instagram-caption">
                          <strong>jbrautoria</strong> {item.subtitulo || item.titulo}
                        </p>
                        <div className="instagram-date">
                          {new Date(item.data_publicacao).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </div>
                        <a 
                          className="instagram-view-btn mt-auto" 
                          href={item.conteudo || "https://www.instagram.com/jbrautoria/"} 
                          target="_blank" 
                          rel="noopener noreferrer"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                          Ver no Instagram
                        </a>
                      </div>`;

const replacementCard = `                      <a 
                        href={item.conteudo || "https://www.instagram.com/jbrautoria/"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="instagram-card-image block relative overflow-hidden group/img cursor-pointer"
                      >
                        {item.imagem_url ? (
                          <img 
                            src={item.imagem_url} 
                            alt={item.titulo} 
                            className="instagram-image group-hover/img:scale-105 transition-transform duration-500"
                            style={{ width: '100%', height: '320px', objectFit: 'cover' }}
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                              const parent = (e.target as HTMLElement).parentElement;
                              if (parent) {
                                parent.className = "instagram-card-image flex flex-col justify-center items-center p-8 bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] text-white w-full h-[320px]";
                                parent.innerHTML = \`
                                  <svg class="w-12 h-12 mb-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                                \`;
                              }
                            }}
                          />
                        ) : (
                          <div className="flex flex-col justify-center items-center p-8 bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] text-white w-full h-[320px]">
                            <svg className="w-12 h-12 mb-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                          </div>
                        )}
                      </a>
                      <div className="instagram-card-body !pt-4 !pb-5 !px-5 flex flex-col justify-between" style={{ minHeight: '130px' }}>
                        <a href={item.conteudo || "https://www.instagram.com/jbrautoria/"} target="_blank" rel="noopener noreferrer" className="hover:opacity-80">
                          <p className="instagram-caption !text-sm !mb-2 line-clamp-3">
                            <strong>jbrautoria</strong> {item.subtitulo || item.titulo}
                          </p>
                        </a>
                        <div className="instagram-date !text-[11px] !mt-0">
                          {new Date(item.data_publicacao).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </div>
                      </div>`;

content = content.replace(targetCard.replace(/\\r\\n/g, '\\n'), replacementCard);
content = content.replace(targetCard.replace(/\\n/g, '\\r\\n'), replacementCard);

fs.writeFileSync(file, content);
console.log('Fixed Instagram Card Rendering');
