export type DiaCategoria = 'letivo' | 'ferias' | 'nao_letivo' | 'em_apc' | 'inicio_ano' | 'exame_final' | 'normal';

export interface DiaCalendario {
  data: string;
  categoria: DiaCategoria;
  abreviacao?: string;
  descricao?: string;
}

export const calendarData: Record<string, DiaCalendario> = {
  "2026-01-01": { "data": "2026-01-01", "categoria": "nao_letivo",
    "abreviacao": "FN",
    "descricao": "Confraternização Universal (Dia Mundial da Paz)"
  },
  "2026-01-02": { "data": "2026-01-02", "categoria": "nao_letivo",
    "abreviacao": "NL",
    "descricao": "Não Letivo"
  },
  "2026-01-05": { "data": "2026-01-05", "categoria": "ferias",
    "abreviacao": "",
    "descricao": ""
  },
  "2026-01-06": { "data": "2026-01-06", "categoria": "ferias",
    "abreviacao": "",
    "descricao": ""
  },
  "2026-01-07": { "data": "2026-01-07", "categoria": "ferias",
    "abreviacao": "",
    "descricao": ""
  },
  "2026-01-08": { "data": "2026-01-08", "categoria": "ferias",
    "abreviacao": "",
    "descricao": ""
  },
  "2026-01-09": { "data": "2026-01-09", "categoria": "ferias",
    "abreviacao": "",
    "descricao": ""
  },
  "2026-01-12": { "data": "2026-01-12", "categoria": "ferias",
    "abreviacao": "",
    "descricao": ""
  },
  "2026-01-13": { "data": "2026-01-13", "categoria": "ferias",
    "abreviacao": "",
    "descricao": ""
  },
  "2026-01-14": { "data": "2026-01-14", "categoria": "ferias",
    "abreviacao": "",
    "descricao": ""
  },
  "2026-01-15": { "data": "2026-01-15", "categoria": "ferias",
    "abreviacao": "",
    "descricao": ""
  },
  "2026-01-16": { "data": "2026-01-16", "categoria": "ferias",
    "abreviacao": "",
    "descricao": ""
  },
  "2026-01-19": { "data": "2026-01-19", "categoria": "ferias",
    "abreviacao": "",
    "descricao": ""
  },
  "2026-01-20": { "data": "2026-01-20", "categoria": "ferias",
    "abreviacao": "",
    "descricao": ""
  },
  "2026-01-21": { "data": "2026-01-21", "categoria": "ferias",
    "abreviacao": "",
    "descricao": ""
  },
  "2026-01-22": { "data": "2026-01-22", "categoria": "ferias",
    "abreviacao": "",
    "descricao": ""
  },
  "2026-01-23": { "data": "2026-01-23", "categoria": "ferias",
    "abreviacao": "",
    "descricao": ""
  },
  "2026-01-26": { "data": "2026-01-26", "categoria": "ferias",
    "abreviacao": "",
    "descricao": ""
  },
  "2026-01-27": { "data": "2026-01-27", "categoria": "ferias",
    "abreviacao": "",
    "descricao": ""
  },
  "2026-01-28": { "data": "2026-01-28", "categoria": "ferias",
    "abreviacao": "",
    "descricao": ""
  },
  "2026-01-29": { "data": "2026-01-29", "categoria": "ferias",
    "abreviacao": "",
    "descricao": ""
  },
  "2026-01-30": { "data": "2026-01-30", "categoria": "ferias",
    "abreviacao": "",
    "descricao": ""
  },
  "2026-02-02": { "data": "2026-02-02", "categoria": "inicio_ano",
    "abreviacao": "IA",
    "descricao": "Início do Ano Escolar e Confirmação da Lotação"
  },
  "2026-02-03": { "data": "2026-02-03", "categoria": "letivo",
    "abreviacao": "IAL",
    "descricao": "Início do Ano Letivo e do 1º Bimestre"
  },
  "2026-02-16": { "data": "2026-02-16", "categoria": "nao_letivo",
    "abreviacao": "NL",
    "descricao": "Não Letivo"
  },
  "2026-02-17": { "data": "2026-02-17", "categoria": "nao_letivo",
    "abreviacao": "NL",
    "descricao": "Carnaval"
  },
  "2026-02-18": { "data": "2026-02-18", "categoria": "nao_letivo",
    "abreviacao": "NL",
    "descricao": "Cinzas"
  },
  "2026-02-28": { "data": "2026-02-28", "categoria": "letivo",
    "abreviacao": "F&E",
    "descricao": "Sábado Letivo - Família e Escola"
  },
  "2026-04-02": { "data": "2026-04-02", "categoria": "nao_letivo",
    "abreviacao": "NL",
    "descricao": "Não Letivo"
  },
  "2026-04-03": { "data": "2026-04-03", "categoria": "nao_letivo",
    "abreviacao": "FN",
    "descricao": "Sexta-feira Santa"
  },
  "2026-04-06": { "data": "2026-04-06", "categoria": "letivo",
    "abreviacao": "AB",
    "descricao": "Avaliações Bimestrais"
  },
  "2026-04-07": { "data": "2026-04-07", "categoria": "letivo",
    "abreviacao": "AB",
    "descricao": "Avaliações Bimestrais"
  },
  "2026-04-08": { "data": "2026-04-08", "categoria": "letivo",
    "abreviacao": "AB",
    "descricao": "Avaliações Bimestrais"
  },
  "2026-04-09": { "data": "2026-04-09", "categoria": "letivo",
    "abreviacao": "AB",
    "descricao": "Avaliações Bimestrais"
  },
  "2026-04-10": { "data": "2026-04-10", "categoria": "letivo",
    "abreviacao": "AB",
    "descricao": "Avaliações Bimestrais"
  },
  "2026-04-20": { "data": "2026-04-20", "categoria": "em_apc",
    "abreviacao": "EM",
    "descricao": "Emenda com APC"
  },
  "2026-04-21": { "data": "2026-04-21", "categoria": "nao_letivo",
    "abreviacao": "FN",
    "descricao": "Tiradentes"
  },
  "2026-04-22": { "data": "2026-04-22", "categoria": "letivo",
    "abreviacao": "LMBP",
    "descricao": "Lançamento Média Bimestral Parcial"
  },
  "2026-04-24": { "data": "2026-04-24", "categoria": "letivo",
    "abreviacao": "PC",
    "descricao": "Pré-Conselho"
  },
  "2026-04-27": { "data": "2026-04-27", "categoria": "letivo",
    "abreviacao": "PC",
    "descricao": "Pré-Conselho"
  },
  "2026-04-28": { "data": "2026-04-28", "categoria": "letivo",
    "abreviacao": "CC",
    "descricao": "Conselho de Classe"
  },
  "2026-04-30": { "data": "2026-04-30", "categoria": "letivo",
    "abreviacao": "TB",
    "descricao": "Término de Bimestre e Lançamento Final"
  },
  "2026-05-01": { "data": "2026-05-01", "categoria": "nao_letivo",
    "abreviacao": "FN",
    "descricao": "Dia do Trabalho"
  },
  "2026-05-04": { "data": "2026-05-04", "categoria": "em_apc",
    "abreviacao": "JF",
    "descricao": "Jornada Formativa com APC"
  },
  "2026-05-29": { "data": "2026-05-29", "categoria": "letivo",
    "abreviacao": "RPP",
    "descricao": "Avaliação do RPP"
  },
  "2026-06-04": { "data": "2026-06-04", "categoria": "nao_letivo",
    "abreviacao": "PF",
    "descricao": "Corpus Christi"
  },
  "2026-06-05": { "data": "2026-06-05", "categoria": "nao_letivo",
    "abreviacao": "NL",
    "descricao": "Não Letivo"
  },
  "2026-06-13": { "data": "2026-06-13", "categoria": "nao_letivo",
    "abreviacao": "FM",
    "descricao": "Santo Antônio"
  },
  "2026-06-20": { "data": "2026-06-20", "categoria": "letivo",
    "abreviacao": "F&E",
    "descricao": "Sábado Letivo - Família e Escola"
  },
  "2026-06-22": { "data": "2026-06-22", "categoria": "letivo",
    "abreviacao": "AB",
    "descricao": "Avaliações Bimestrais"
  },
  "2026-06-23": { "data": "2026-06-23", "categoria": "letivo",
    "abreviacao": "AB",
    "descricao": "Avaliações Bimestrais"
  },
  "2026-06-24": { "data": "2026-06-24", "categoria": "letivo",
    "abreviacao": "AB",
    "descricao": "Avaliações Bimestrais"
  },
  "2026-06-25": { "data": "2026-06-25", "categoria": "letivo",
    "abreviacao": "AB",
    "descricao": "Avaliações Bimestrais"
  },
  "2026-06-26": { "data": "2026-06-26", "categoria": "letivo",
    "abreviacao": "AB",
    "descricao": "Avaliações Bimestrais"
  },
  "2026-06-29": { "data": "2026-06-29", "categoria": "letivo",
    "abreviacao": "LMBP",
    "descricao": "Lançamento Média Parcial"
  },
  "2026-06-30": { "data": "2026-06-30", "categoria": "letivo",
    "abreviacao": "PC",
    "descricao": "Pré-Conselho"
  },
  "2026-07-01": { "data": "2026-07-01", "categoria": "letivo",
    "abreviacao": "PC",
    "descricao": "Pré-Conselho"
  },
  "2026-07-02": { "data": "2026-07-02", "categoria": "letivo",
    "abreviacao": "PC",
    "descricao": "Pré-Conselho"
  },
  "2026-07-03": { "data": "2026-07-03", "categoria": "letivo",
    "abreviacao": "PC",
    "descricao": "Pré-Conselho"
  },
  "2026-07-06": { "data": "2026-07-06", "categoria": "letivo",
    "abreviacao": "RAV",
    "descricao": "Recuperar para Avançar"
  },
  "2026-07-07": { "data": "2026-07-07", "categoria": "letivo",
    "abreviacao": "RAV",
    "descricao": "Recuperar para Avançar"
  },
  "2026-07-08": { "data": "2026-07-08", "categoria": "letivo",
    "abreviacao": "RAV",
    "descricao": "Recuperar para Avançar"
  },
  "2026-07-09": { "data": "2026-07-09", "categoria": "letivo",
    "abreviacao": "RAV",
    "descricao": "Recuperar para Avançar"
  },
  "2026-07-10": { "data": "2026-07-10", "categoria": "letivo",
    "abreviacao": "RAV",
    "descricao": "Recuperar para Avançar"
  },
  "2026-07-13": { "data": "2026-07-13", "categoria": "letivo",
    "abreviacao": "RAV",
    "descricao": "Recuperar para Avançar"
  },
  "2026-07-14": { "data": "2026-07-14", "categoria": "letivo",
    "abreviacao": "RAV",
    "descricao": "Recuperar para Avançar"
  },
  "2026-07-15": { "data": "2026-07-15", "categoria": "letivo",
    "abreviacao": "RAV",
    "descricao": "Recuperar para Avançar"
  },
  "2026-07-16": { "data": "2026-07-16", "categoria": "letivo",
    "abreviacao": "TB",
    "descricao": "Conselho de Classe e Término do 2º Bimestre"
  },
  "2026-07-17": { "data": "2026-07-17", "categoria": "ferias",
    "abreviacao": "RE",
    "descricao": "Recesso Escolar"
  },
  "2026-07-20": { "data": "2026-07-20", "categoria": "ferias",
    "abreviacao": "RE",
    "descricao": "Recesso Escolar"
  },
  "2026-07-21": { "data": "2026-07-21", "categoria": "ferias",
    "abreviacao": "RE",
    "descricao": "Recesso Escolar"
  },
  "2026-07-22": { "data": "2026-07-22", "categoria": "ferias",
    "abreviacao": "RE",
    "descricao": "Recesso Escolar"
  },
  "2026-07-23": { "data": "2026-07-23", "categoria": "ferias",
    "abreviacao": "RE",
    "descricao": "Recesso Escolar"
  },
  "2026-07-24": { "data": "2026-07-24", "categoria": "ferias",
    "abreviacao": "RE",
    "descricao": "Recesso Escolar"
  },
  "2026-07-27": { "data": "2026-07-27", "categoria": "ferias",
    "abreviacao": "RE",
    "descricao": "Recesso Escolar"
  },
  "2026-07-28": { "data": "2026-07-28", "categoria": "ferias",
    "abreviacao": "RE",
    "descricao": "Recesso Escolar"
  },
  "2026-07-29": { "data": "2026-07-29", "categoria": "ferias",
    "abreviacao": "RE",
    "descricao": "Recesso Escolar"
  },
  "2026-07-30": { "data": "2026-07-30", "categoria": "ferias",
    "abreviacao": "RE",
    "descricao": "Recesso Escolar"
  },
  "2026-07-31": { "data": "2026-07-31", "categoria": "ferias",
    "abreviacao": "RE",
    "descricao": "Recesso Escolar"
  },
  "2026-08-03": { "data": "2026-08-03", "categoria": "letivo",
    "abreviacao": "IB",
    "descricao": "Início do 3º Bimestre"
  },
  "2026-08-04": { "data": "2026-08-04", "categoria": "em_apc",
    "abreviacao": "JF",
    "descricao": "Jornada Formativa com APC"
  },
  "2026-08-05": { "data": "2026-08-05", "categoria": "em_apc",
    "abreviacao": "JF",
    "descricao": "Jornada Formativa com APC"
  },
  "2026-08-06": { "data": "2026-08-06", "categoria": "em_apc",
    "abreviacao": "JF",
    "descricao": "Jornada Formativa com APC"
  },
  "2026-08-07": { "data": "2026-08-07", "categoria": "em_apc",
    "abreviacao": "JF",
    "descricao": "Jornada Formativa com APC"
  },
  "2026-08-15": { "data": "2026-08-15", "categoria": "letivo",
    "abreviacao": "F&E",
    "descricao": "Sábado Letivo - Família e Escola"
  },
  "2026-08-26": { "data": "2026-08-26", "categoria": "nao_letivo",
    "abreviacao": "FM",
    "descricao": "Aniversário de Campo Grande"
  },
  "2026-09-07": { "data": "2026-09-07", "categoria": "nao_letivo",
    "abreviacao": "FN",
    "descricao": "Independência do Brasil"
  },
  "2026-09-08": { "data": "2026-09-08", "categoria": "letivo",
    "abreviacao": "AB",
    "descricao": "Avaliações Bimestrais"
  },
  "2026-09-09": { "data": "2026-09-09", "categoria": "letivo",
    "abreviacao": "AB",
    "descricao": "Avaliações Bimestrais"
  },
  "2026-09-10": { "data": "2026-09-10", "categoria": "letivo",
    "abreviacao": "AB",
    "descricao": "Avaliações Bimestrais"
  },
  "2026-09-11": { "data": "2026-09-11", "categoria": "letivo",
    "abreviacao": "AB",
    "descricao": "Avaliações Bimestrais"
  },
  "2026-09-14": { "data": "2026-09-14", "categoria": "letivo",
    "abreviacao": "AB",
    "descricao": "Avaliações Bimestrais"
  },
  "2026-09-21": { "data": "2026-09-21", "categoria": "letivo",
    "abreviacao": "LMBP",
    "descricao": "Lançamento Média Parcial"
  },
  "2026-09-22": { "data": "2026-09-22", "categoria": "letivo",
    "abreviacao": "PC",
    "descricao": "Pré-Conselho"
  },
  "2026-09-23": { "data": "2026-09-23", "categoria": "letivo",
    "abreviacao": "PC",
    "descricao": "Pré-Conselho"
  },
  "2026-09-24": { "data": "2026-09-24", "categoria": "letivo",
    "abreviacao": "PC",
    "descricao": "Pré-Conselho"
  },
  "2026-09-25": { "data": "2026-09-25", "categoria": "letivo",
    "abreviacao": "PC",
    "descricao": "Pré-Conselho"
  },
  "2026-09-28": { "data": "2026-09-28", "categoria": "letivo",
    "abreviacao": "PC",
    "descricao": "Pré-Conselho"
  },
  "2026-10-01": { "data": "2026-10-01", "categoria": "letivo",
    "abreviacao": "TB",
    "descricao": "Conselho de Classe e Término do 3º Bimestre"
  },
  "2026-10-02": { "data": "2026-10-02", "categoria": "letivo",
    "abreviacao": "IB",
    "descricao": "Início do 4º Bimestre e Jornada Formativa"
  },
  "2026-10-12": { "data": "2026-10-12", "categoria": "nao_letivo",
    "abreviacao": "FN",
    "descricao": "Nossa Senhora Aparecida"
  },
  "2026-10-13": { "data": "2026-10-13", "categoria": "em_apc",
    "abreviacao": "EM",
    "descricao": "Emenda com APC"
  },
  "2026-10-14": { "data": "2026-10-14", "categoria": "em_apc",
    "abreviacao": "EM",
    "descricao": "Emenda com APC"
  },
  "2026-10-15": { "data": "2026-10-15", "categoria": "nao_letivo",
    "abreviacao": "FE",
    "descricao": "Dia do Professor"
  },
  "2026-10-16": { "data": "2026-10-16", "categoria": "nao_letivo",
    "abreviacao": "NL",
    "descricao": "Antecipação Dia do Servidor / Não Letivo"
  },
  "2026-10-24": { "data": "2026-10-24", "categoria": "letivo",
    "abreviacao": "F&E",
    "descricao": "Sábado Letivo - Família e Escola"
  },
  "2026-10-30": { "data": "2026-10-30", "categoria": "letivo",
    "abreviacao": "RPP",
    "descricao": "Avaliação de RPP"
  },
  "2026-11-02": { "data": "2026-11-02", "categoria": "nao_letivo",
    "abreviacao": "FN",
    "descricao": "Finados"
  },
  "2026-11-13": { "data": "2026-11-13", "categoria": "letivo",
    "abreviacao": "AB",
    "descricao": "Avaliações Bimestrais"
  },
  "2026-11-16": { "data": "2026-11-16", "categoria": "letivo",
    "abreviacao": "AB",
    "descricao": "Avaliações Bimestrais"
  },
  "2026-11-17": { "data": "2026-11-17", "categoria": "letivo",
    "abreviacao": "AB",
    "descricao": "Avaliações Bimestrais"
  },
  "2026-11-18": { "data": "2026-11-18", "categoria": "letivo",
    "abreviacao": "AB",
    "descricao": "Avaliações Bimestrais"
  },
  "2026-11-19": { "data": "2026-11-19", "categoria": "letivo",
    "abreviacao": "AB",
    "descricao": "Avaliações Bimestrais"
  },
  "2026-11-20": { "data": "2026-11-20", "categoria": "nao_letivo",
    "abreviacao": "FN",
    "descricao": "Consciência Negra"
  },
  "2026-11-23": { "data": "2026-11-23", "categoria": "letivo",
    "abreviacao": "LMBP",
    "descricao": "Lançamento Média Parcial"
  },
  "2026-11-24": { "data": "2026-11-24", "categoria": "letivo",
    "abreviacao": "PC",
    "descricao": "Pré-Conselho"
  },
  "2026-11-25": { "data": "2026-11-25", "categoria": "letivo",
    "abreviacao": "PC",
    "descricao": "Pré-Conselho"
  },
  "2026-11-26": { "data": "2026-11-26", "categoria": "letivo",
    "abreviacao": "PC",
    "descricao": "Pré-Conselho"
  },
  "2026-11-27": { "data": "2026-11-27", "categoria": "letivo",
    "abreviacao": "PC",
    "descricao": "Pré-Conselho"
  },
  "2026-11-30": { "data": "2026-11-30", "categoria": "letivo",
    "abreviacao": "RAV",
    "descricao": "Recuperar para Avançar"
  },
  "2026-12-01": { "data": "2026-12-01", "categoria": "letivo",
    "abreviacao": "RAV",
    "descricao": "Recuperar para Avançar"
  },
  "2026-12-02": { "data": "2026-12-02", "categoria": "letivo",
    "abreviacao": "RAV",
    "descricao": "Recuperar para Avançar"
  },
  "2026-12-03": { "data": "2026-12-03", "categoria": "letivo",
    "abreviacao": "RAV",
    "descricao": "Recuperar para Avançar"
  },
  "2026-12-04": { "data": "2026-12-04", "categoria": "letivo",
    "abreviacao": "RAV",
    "descricao": "Recuperar para Avançar"
  },
  "2026-12-07": { "data": "2026-12-07", "categoria": "letivo",
    "abreviacao": "CC",
    "descricao": "Conselho de Classe"
  },
  "2026-12-08": { "data": "2026-12-08", "categoria": "letivo",
    "abreviacao": "CC",
    "descricao": "Conselho de Classe"
  },
  "2026-12-09": { "data": "2026-12-09", "categoria": "letivo",
    "abreviacao": "TB",
    "descricao": "Lançamento Média Final e Término do Ano Letivo"
  },
  "2026-12-10": { "data": "2026-12-10", "categoria": "exame_final",
    "abreviacao": "EF",
    "descricao": "Exame Final"
  },
  "2026-12-11": { "data": "2026-12-11", "categoria": "exame_final",
    "abreviacao": "EF",
    "descricao": "Exame Final"
  },
  "2026-12-14": { "data": "2026-12-14", "categoria": "exame_final",
    "abreviacao": "EF",
    "descricao": "Exame Final"
  },
  "2026-12-15": { "data": "2026-12-15", "categoria": "exame_final",
    "abreviacao": "EF",
    "descricao": "Exame Final"
  },
  "2026-12-16": { "data": "2026-12-16", "categoria": "exame_final",
    "abreviacao": "EF",
    "descricao": "Exame Final"
  },
  "2026-12-17": { "data": "2026-12-17", "categoria": "exame_final",
    "abreviacao": "CCF",
    "descricao": "Conselho de Classe Final"
  },
  "2026-12-18": { "data": "2026-12-18", "categoria": "exame_final",
    "abreviacao": "FR",
    "descricao": "Finalização Resultados e Término Ano Escolar"
  },
  "2026-02-04": { "data": "2026-02-04", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-02-05": { "data": "2026-02-05", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-02-06": { "data": "2026-02-06", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-02-09": { "data": "2026-02-09", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-02-10": { "data": "2026-02-10", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-02-11": { "data": "2026-02-11", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-02-12": { "data": "2026-02-12", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-02-13": { "data": "2026-02-13", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-02-19": { "data": "2026-02-19", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-02-20": { "data": "2026-02-20", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-02-23": { "data": "2026-02-23", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-02-24": { "data": "2026-02-24", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-02-25": { "data": "2026-02-25", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-02-26": { "data": "2026-02-26", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-02-27": { "data": "2026-02-27", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-03-02": { "data": "2026-03-02", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-03-03": { "data": "2026-03-03", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-03-04": { "data": "2026-03-04", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-03-05": { "data": "2026-03-05", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-03-06": { "data": "2026-03-06", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-03-09": { "data": "2026-03-09", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-03-10": { "data": "2026-03-10", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-03-11": { "data": "2026-03-11", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-03-12": { "data": "2026-03-12", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-03-13": { "data": "2026-03-13", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-03-16": { "data": "2026-03-16", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-03-17": { "data": "2026-03-17", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-03-18": { "data": "2026-03-18", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-03-19": { "data": "2026-03-19", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-03-20": { "data": "2026-03-20", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-03-23": { "data": "2026-03-23", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-03-24": { "data": "2026-03-24", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-03-25": { "data": "2026-03-25", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-03-26": { "data": "2026-03-26", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-03-27": { "data": "2026-03-27", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-03-30": { "data": "2026-03-30", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-03-31": { "data": "2026-03-31", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-04-01": { "data": "2026-04-01", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-04-13": { "data": "2026-04-13", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-04-14": { "data": "2026-04-14", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-04-15": { "data": "2026-04-15", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-04-16": { "data": "2026-04-16", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-04-17": { "data": "2026-04-17", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-04-23": { "data": "2026-04-23", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-04-29": { "data": "2026-04-29", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-05-05": { "data": "2026-05-05", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-05-06": { "data": "2026-05-06", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-05-07": { "data": "2026-05-07", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-05-08": { "data": "2026-05-08", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-05-11": { "data": "2026-05-11", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-05-12": { "data": "2026-05-12", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-05-13": { "data": "2026-05-13", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-05-14": { "data": "2026-05-14", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-05-15": { "data": "2026-05-15", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-05-18": { "data": "2026-05-18", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-05-19": { "data": "2026-05-19", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-05-20": { "data": "2026-05-20", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-05-21": { "data": "2026-05-21", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-05-22": { "data": "2026-05-22", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-05-25": { "data": "2026-05-25", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-05-26": { "data": "2026-05-26", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-05-27": { "data": "2026-05-27", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-05-28": { "data": "2026-05-28", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-06-01": { "data": "2026-06-01", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-06-02": { "data": "2026-06-02", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-06-03": { "data": "2026-06-03", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-06-08": { "data": "2026-06-08", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-06-09": { "data": "2026-06-09", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-06-10": { "data": "2026-06-10", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-06-11": { "data": "2026-06-11", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-06-12": { "data": "2026-06-12", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-06-15": { "data": "2026-06-15", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-06-16": { "data": "2026-06-16", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-06-17": { "data": "2026-06-17", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-06-18": { "data": "2026-06-18", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-06-19": { "data": "2026-06-19", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-08-10": { "data": "2026-08-10", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-08-11": { "data": "2026-08-11", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-08-12": { "data": "2026-08-12", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-08-13": { "data": "2026-08-13", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-08-14": { "data": "2026-08-14", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-08-17": { "data": "2026-08-17", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-08-18": { "data": "2026-08-18", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-08-19": { "data": "2026-08-19", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-08-20": { "data": "2026-08-20", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-08-21": { "data": "2026-08-21", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-08-24": { "data": "2026-08-24", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-08-25": { "data": "2026-08-25", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-08-27": { "data": "2026-08-27", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-08-28": { "data": "2026-08-28", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-08-31": { "data": "2026-08-31", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-09-01": { "data": "2026-09-01", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-09-02": { "data": "2026-09-02", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-09-03": { "data": "2026-09-03", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-09-04": { "data": "2026-09-04", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-09-15": { "data": "2026-09-15", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-09-16": { "data": "2026-09-16", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-09-17": { "data": "2026-09-17", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-09-18": { "data": "2026-09-18", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-09-29": { "data": "2026-09-29", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-09-30": { "data": "2026-09-30", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-10-05": { "data": "2026-10-05", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-10-06": { "data": "2026-10-06", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-10-07": { "data": "2026-10-07", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-10-08": { "data": "2026-10-08", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-10-09": { "data": "2026-10-09", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-10-19": { "data": "2026-10-19", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-10-20": { "data": "2026-10-20", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-10-21": { "data": "2026-10-21", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-10-22": { "data": "2026-10-22", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-10-23": { "data": "2026-10-23", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-10-26": { "data": "2026-10-26", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-10-27": { "data": "2026-10-27", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-10-28": { "data": "2026-10-28", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-10-29": { "data": "2026-10-29", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-11-03": { "data": "2026-11-03", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-11-04": { "data": "2026-11-04", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-11-05": { "data": "2026-11-05", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-11-06": { "data": "2026-11-06", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-11-09": { "data": "2026-11-09", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-11-10": { "data": "2026-11-10", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-11-11": { "data": "2026-11-11", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-11-12": { "data": "2026-11-12", "categoria": "letivo",
    "abreviacao": "",
    "descricao": "Dia Letivo"
  },
  "2026-12-21": { "data": "2026-12-21", "categoria": "ferias",
    "abreviacao": "",
    "descricao": "Férias Escolares"
  },
  "2026-12-22": { "data": "2026-12-22", "categoria": "ferias",
    "abreviacao": "",
    "descricao": "Férias Escolares"
  },
  "2026-12-23": { "data": "2026-12-23", "categoria": "ferias",
    "abreviacao": "",
    "descricao": "Férias Escolares"
  },
  "2026-12-24": { "data": "2026-12-24", "categoria": "ferias",
    "abreviacao": "",
    "descricao": "Férias Escolares"
  },
  "2026-12-25": { "data": "2026-12-25", "categoria": "ferias",
    "abreviacao": "",
    "descricao": "Férias Escolares"
  },
  "2026-12-28": { "data": "2026-12-28", "categoria": "ferias",
    "abreviacao": "",
    "descricao": "Férias Escolares"
  },
  "2026-12-29": { "data": "2026-12-29", "categoria": "ferias",
    "abreviacao": "",
    "descricao": "Férias Escolares"
  },
  "2026-12-30": { "data": "2026-12-30", "categoria": "ferias",
    "abreviacao": "",
    "descricao": "Férias Escolares"
  },
  "2026-12-31": { "data": "2026-12-31", "categoria": "ferias",
    "abreviacao": "",
    "descricao": "Férias Escolares"
  }
};