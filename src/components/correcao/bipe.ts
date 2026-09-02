// Retorno sonoro da correção. Sem arquivo de áudio: são três tons sintetizados na hora
// pelo WebAudio, o que evita mais um asset e funciona offline.
//
// O som não é enfeite. Corrigindo uma pilha, o professor olha para a folha, não para a
// tela — o bipe é como ele sabe que pode virar o cartão sem conferir o celular a cada
// aluno. Por isso os três casos soam bem diferentes entre si.

type Tipo = 'identificado' | 'sucesso' | 'erro';

const TONS: Record<Tipo, { freq: number; dur: number }[]> = {
  identificado: [{ freq: 880, dur: 0.06 }],
  sucesso: [{ freq: 880, dur: 0.07 }, { freq: 1320, dur: 0.11 }],
  erro: [{ freq: 300, dur: 0.16 }, { freq: 220, dur: 0.2 }],
};

let ctx: AudioContext | null = null;

export async function bipe(tipo: Tipo): Promise<void> {
  try {
    ctx ??= new AudioContext();
    // iOS suspende o contexto até um gesto do usuário; abrir a tela de correção já é um.
    if (ctx.state === 'suspended') await ctx.resume();

    let quando = ctx.currentTime;
    for (const { freq, dur } of TONS[tipo]) {
      const osc = ctx.createOscillator();
      const ganho = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = 'sine';

      // Rampa em vez de liga/desliga seco: um degrau na amplitude estala no alto-falante
      // do celular e o estalo é mais audível que o próprio tom.
      ganho.gain.setValueAtTime(0.0001, quando);
      ganho.gain.exponentialRampToValueAtTime(0.25, quando + 0.01);
      ganho.gain.exponentialRampToValueAtTime(0.0001, quando + dur);

      osc.connect(ganho).connect(ctx.destination);
      osc.start(quando);
      osc.stop(quando + dur + 0.02);
      quando += dur;
    }
  } catch {
    // Sem áudio disponível a correção continua funcionando pela tela — não é motivo
    // para derrubar a leitura.
  }
}
