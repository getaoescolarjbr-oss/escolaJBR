-- Bloqueio do titular durante o atestado/afastamento com substituto.
--
-- Quando marcado (junto com um substituto), o professor titular fica sem acesso às turmas
-- durante o período: só o substituto trabalha nelas. O bloqueio é aplicado pela interface
-- (Dashboard do professor); as políticas RLS não mudam.
--
-- Aditiva e reversível:  alter table public.atestados_servidores drop column bloquear_titular;
alter table public.atestados_servidores
  add column if not exists bloquear_titular boolean not null default false;

comment on column public.atestados_servidores.bloquear_titular is
  'Se true e houver substituto_id, o titular não acessa as turmas durante o período (só o substituto).';
