import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://hqonnxnwozfwkpqgabpf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU'
);

await supabase.auth.signInWithPassword({ email: 'gestaoescolarjbr@gmail.com', password: 'Gest@ojbr' });

// IDs
const ADMIN_PROF_ID = 'd7192977-80cc-4df9-9235-08623d093db2';
const BIMESTRE = 1;

const TURMAS = {
  '6A': 'bd1df917-640f-431e-81eb-4d8e88bdc6f5',
  '7A': '72fdf92e-4b47-4d97-8e02-c2e89548c80e',
  '1A': '40240976-446c-43a0-89ee-41ee204125ea',
};

const DISC = {
  'Arte':                     '88bb8abd-12d1-4245-868c-7fd84829a0e5',
  'Ciências':                 '60aaff69-4879-4e61-9e9f-30b443866d0e',
  'CiênciasHum':              '8024bb67-8169-4cce-b1c5-789fc46e3203',
  'CiênciasNat':              'cac4014d-cab9-4606-a526-2d37d2940da8',
  'EducaçãoFísica':           'ff64b726-f719-4a5a-8f6b-e8f2c0e1944d',
  'EnsinoReligioso':          '656ab75f-8e00-4b97-a430-b45e31f781cb',
  'Geografia':                'f01e8067-0d0e-4ceb-9168-caabe16ea582',
  'História':                 '74db41d8-0a9e-416f-ab79-5a2dd264b572',
  'LabLinguas':               '1cc4b63b-fbb8-4368-affd-a182a5ceb3a9',
  'LetMat':                   'bf753cd6-67e3-46da-b235-f664a4fd1296',
  'LitArteMov':               '6f93a67a-0f54-41ef-9a14-edd992413b5e',
  'LingEspanhola':            'e94be167-cb07-473b-938b-e80665bfca84',
  'LingInglesa':              '1e3550ad-cc84-458d-a30b-c13adce4598d',
  'LingPortuguesa':           'ea9c7c1c-4d1c-4a55-accd-8467981dd6f4',
  'LingPortLitProd':          '3686b799-b002-439f-bfb7-68f61ca4a937',
  'LingPortRA':               'fd8bb29a-0a89-4c47-ac95-da1ce6db07b4',
  'Matemática':               'dacd1f5f-eed5-470c-8fff-847953b660a1',
  'MatemáticaGeo':            '67db400b-ed42-4a6f-993f-0ceed2f34928',
  'MatemáticaRA':             '7cdecd0f-abdb-456f-8bc6-53ebb5b00171',
  'TecnologiaCidadania':      '44d8e59c-2e7c-4a96-bd4d-fdfc74481554',
  'ApoioOrient':              '7a4aec82-a97d-4e03-bd59-211d2a53d336',
  'Biologia':                 '44c05467-306c-4fb2-ba5c-500ada2334b4',
  'LeitProdTextual':          '8c9ffde4-333d-46bc-b4b5-d4c343442e1d',
  'PraticaEscritaEstilo':     '9431e88d-e766-4b5c-b28e-1dc425b2824f',
};

// ========== DATA LIDA DAS IMAGENS ==========

// IMAGE 1: 6º Ano A
// Cols: Apoio/Orient | Arte | Ciências | CiênciasHum | CiênciasNat | EducFísica | Geografia | História | Letramento/RacMat | LitArteMov | LingEsp | LingInglesa | LingPortuguesa | Matemática | MatemáticaRA | LingPort | TecnologiaC | Faltas
const grades6A = [
  { nome: 'ADRYAN JOSÉ RIBEIRO ZAGHI',                    ApoioOrient: null, Arte: 6,    Ciências: 7,   CiênciasHum: null, CiênciasNat: 6.5, EducaçãoFísica: 9,   Geografia: 6,   História: 3.5, LetMat: 6.5, LitArteMov: 7.5, LingEspanhola: 7,   LingInglesa: 8,    LingPortuguesa: 5.5, Matemática: 6,   MatemáticaRA: null, LingPortLitProd: 7, TecnologiaCidadania: 7 },
  { nome: 'ALICY YASMYN SAAB CABRAL DE REZENDE SANTANA',  ApoioOrient: 'SN',Arte: 6.5,  Ciências: 8,   CiênciasHum: null, CiênciasNat: 9,   EducaçãoFísica: 9.5, Geografia: 9.5, História: 6.2, LetMat: null, LitArteMov: null, LingEspanhola: 8.5, LingInglesa: 7,    LingPortuguesa: null, Matemática: null,MatemáticaRA: null, LingPortLitProd: null, TecnologiaCidadania: null },
  { nome: 'ANNA JÚLIA FERREIRA',                          ApoioOrient: 'SN',Arte: 9.5,  Ciências: 7,   CiênciasHum: null, CiênciasNat: 9.5, EducaçãoFísica: 9.5, Geografia: 9,   História: 8.5, LetMat: 8,   LitArteMov: 9.5, LingEspanhola: 9,   LingInglesa: 9.5,  LingPortuguesa: 8.5, Matemática: 7.5, MatemáticaRA: null, LingPortLitProd: 9, TecnologiaCidadania: 8 },
  { nome: 'ANTONIA PACHECO BARBOSA DOS SANTOS',           ApoioOrient: 'SN',Arte: 10.8, Ciências: 7.5, CiênciasHum: null, CiênciasNat: 9,   EducaçãoFísica: 9.5, Geografia: 9.5, História: 8.5, LetMat: null, LitArteMov: null, LingEspanhola: 8.5, LingInglesa: 7,    LingPortuguesa: 8.5, Matemática: 7.5, MatemáticaRA: null, LingPortLitProd: 8.5, TecnologiaCidadania: 8 },
  { nome: 'ARTHUR AUBRY PELEGRINI HERNANDES',             ApoioOrient: null, Arte: 7,    Ciências: 9.5, CiênciasHum: null, CiênciasNat: 9.5, EducaçãoFísica: 9.5, Geografia: 10,  História: 9,   LetMat: 9.5, LitArteMov: null, LingEspanhola: null,LingInglesa: 10,   LingPortuguesa: 9,   Matemática: 9.5, MatemáticaRA: null, LingPortLitProd: 9.5, TecnologiaCidadania: null },
  { nome: 'ARTHUR LOBO PEREIRA EONCONI',                  ApoioOrient: null, Arte: 10,   Ciências: 6,   CiênciasHum: null, CiênciasNat: 10,  EducaçãoFísica: 15,  Geografia: 9.5, História: 6,   LetMat: null, LitArteMov: 10,  LingEspanhola: null, LingInglesa: null,  LingPortuguesa: null, Matemática: 9.5, MatemáticaRA: null, LingPortLitProd: null, TecnologiaCidadania: null },
  { nome: 'CARLOS EDUARDO MACÊDO FERREIRA',               ApoioOrient: null, Arte: 8,    Ciências: 6,   CiênciasHum: null, CiênciasNat: 10,  EducaçãoFísica: 10,  Geografia: 9.5, História: 8.5, LetMat: null, LitArteMov: 12,  LingEspanhola: null, LingInglesa: null,  LingPortuguesa: 6.5, Matemática: 6.5, MatemáticaRA: null, LingPortLitProd: 6.5, TecnologiaCidadania: null },
  { nome: 'CARLOS HENRIQUE MOREIRA PALANCIO',             ApoioOrient: null, Arte: 4.5,  Ciências: 6,   CiênciasHum: null, CiênciasNat: 10,  EducaçãoFísica: 12,  Geografia: null, História: null, LetMat: null, LitArteMov: null, LingEspanhola: null, LingInglesa: 6.5,  LingPortuguesa: null, Matemática: null,MatemáticaRA: null, LingPortLitProd: null, TecnologiaCidadania: null },
  { nome: 'DANIEL HENRIQUE GONÇALVES SOVERNIGO',          ApoioOrient: null, Arte: 7.5,  Ciências: 6.5, CiênciasHum: null, CiênciasNat: 6.5, EducaçãoFísica: 12,  Geografia: 9.5, História: 8.5, LetMat: null, LitArteMov: 8.5, LingEspanhola: 4,   LingInglesa: 6,    LingPortuguesa: 6.5, Matemática: 4,   MatemáticaRA: null, LingPortLitProd: 6.5, TecnologiaCidadania: null },
  { nome: 'DIEGO NOGUEIRA FOGAÇA',                        ApoioOrient: 'SN',Arte: null,  Ciências: null,CiênciasHum: null, CiênciasNat: null, EducaçãoFísica: null,Geografia: null,História: null, LetMat: null, LitArteMov: null, LingEspanhola: null, LingInglesa: null,  LingPortuguesa: null, Matemática: null,MatemáticaRA: null, LingPortLitProd: null, TecnologiaCidadania: null },
  { nome: 'EDUARDO DA CRUZ CORRÊA NETO',                  ApoioOrient: 'SN',Arte: null,  Ciências: null,CiênciasHum: null, CiênciasNat: null, EducaçãoFísica: null,Geografia: null,História: null, LetMat: null, LitArteMov: null, LingEspanhola: null, LingInglesa: null,  LingPortuguesa: null, Matemática: null,MatemáticaRA: null, LingPortLitProd: null, TecnologiaCidadania: null },
  { nome: 'EMANUEL DAVI CORRÊA DE ALMEIDA BARBOSA',       ApoioOrient: null, Arte: 8.5,  Ciências: 7,   CiênciasHum: null, CiênciasNat: 7.5, EducaçãoFísica: null, Geografia: null, História: 7.2, LetMat: null, LitArteMov: 6.5, LingEspanhola: 6.5, LingInglesa: null,  LingPortuguesa: null, Matemática: null,MatemáticaRA: null, LingPortLitProd: null, TecnologiaCidadania: null },
  { nome: 'EMANUELLY SOUZA SILVA',                        ApoioOrient: 'SN',Arte: null,  Ciências: null,CiênciasHum: null, CiênciasNat: null, EducaçãoFísica: null,Geografia: null,História: null, LetMat: null, LitArteMov: null, LingEspanhola: null, LingInglesa: null,  LingPortuguesa: null, Matemática: null,MatemáticaRA: null, LingPortLitProd: null, TecnologiaCidadania: null },
  { nome: 'GABRIEL DA SILVA ANTUNES',                     ApoioOrient: 'SN',Arte: null,  Ciências: null,CiênciasHum: null, CiênciasNat: null, EducaçãoFísica: null,Geografia: null,História: null, LetMat: null, LitArteMov: null, LingEspanhola: null, LingInglesa: null,  LingPortuguesa: null, Matemática: null,MatemáticaRA: null, LingPortLitProd: null, TecnologiaCidadania: null },
  { nome: 'GABRIEL SILVA SANTELA',                        ApoioOrient: 'SN',Arte: null,  Ciências: null,CiênciasHum: null, CiênciasNat: null, EducaçãoFísica: null,Geografia: null,História: null, LetMat: null, LitArteMov: null, LingEspanhola: null, LingInglesa: null,  LingPortuguesa: null, Matemática: null,MatemáticaRA: null, LingPortLitProd: null, TecnologiaCidadania: null },
  { nome: 'GUILHERME RODRIGUES COSTA',                    ApoioOrient: 'SN',Arte: 10.8, Ciências: 8.5, CiênciasHum: null, CiênciasNat: 9.5, EducaçãoFísica: 10,  Geografia: 9,   História: 8.5, LetMat: 9.5, LitArteMov: 9.5, LingEspanhola: 9,   LingInglesa: 9.5,  LingPortuguesa: 8.5, Matemática: 9,   MatemáticaRA: null, LingPortLitProd: 8.5, TecnologiaCidadania: 8 },
  { nome: 'GUSTAVO FRANCOLINO FRANÇA',                    ApoioOrient: 'SN',Arte: 10.8, Ciências: 8.5, CiênciasHum: null, CiênciasNat: 9,   EducaçãoFísica: 9,   Geografia: 8.5, História: 8.5, LetMat: 9.5, LitArteMov: null, LingEspanhola: 8.5, LingInglesa: 8.5,  LingPortuguesa: 7.5, Matemática: 9,   MatemáticaRA: null, LingPortLitProd: 7.5, TecnologiaCidadania: 8 },
  { nome: 'ISABELLY FERNANDES LIMA',                      ApoioOrient: null, Arte: 9.5,  Ciências: 8,   CiênciasHum: null, CiênciasNat: 9,   EducaçãoFísica: 9.5, Geografia: 9,   História: 8.5, LetMat: 8.5, LitArteMov: 8.5, LingEspanhola: 7,   LingInglesa: 8.5,  LingPortuguesa: 8.5, Matemática: 7.5, MatemáticaRA: null, LingPortLitProd: 8.5, TecnologiaCidadania: null },
  { nome: 'JOÃO GABRIEL BARBOSA MARTINS',                 ApoioOrient: null, Arte: 8.5,  Ciências: 8,   CiênciasHum: null, CiênciasNat: 9,   EducaçãoFísica: 9.5, Geografia: 8.5, História: 7.5, LetMat: 8.5, LitArteMov: 8.5, LingEspanhola: 7.5, LingInglesa: 9,    LingPortuguesa: 7,   Matemática: 7.5, MatemáticaRA: null, LingPortLitProd: 7, TecnologiaCidadania: null },
  { nome: 'JOSÉ GABRIEL MACHADO VALDEZ CHAGAS',           ApoioOrient: null, Arte: 8.5,  Ciências: 7.5, CiênciasHum: null, CiênciasNat: 9,   EducaçãoFísica: 9.5, Geografia: 8.5, História: 8.5, LetMat: 9,   LitArteMov: 9,   LingEspanhola: 7.5, LingInglesa: 8.5,  LingPortuguesa: 7,   Matemática: 8,   MatemáticaRA: null, LingPortLitProd: 7, TecnologiaCidadania: null },
  { nome: 'LETICIA WEILLER MOURA',                        ApoioOrient: 'SN',Arte: 8.5,  Ciências: 8.5, CiênciasHum: null, CiênciasNat: 9.5, EducaçãoFísica: 10,  Geografia: 8.5, História: 8.5, LetMat: null, LitArteMov: null, LingEspanhola: 9,   LingInglesa: null,  LingPortuguesa: 6,   Matemática: 7,   MatemáticaRA: null, LingPortLitProd: 6, TecnologiaCidadania: null },
  { nome: 'LUIZ ANTONIO DOS SANTOS RIBEIRO',              ApoioOrient: 'SN',Arte: null,  Ciências: null,CiênciasHum: null, CiênciasNat: null, EducaçãoFísica: null,Geografia: null,História: null, LetMat: null, LitArteMov: null, LingEspanhola: null, LingInglesa: null,  LingPortuguesa: null, Matemática: null,MatemáticaRA: null, LingPortLitProd: null, TecnologiaCidadania: null },
  { nome: 'MARCELA ANGELO CARDOSO DE MOURA',              ApoioOrient: 'SN',Arte: 10.8, Ciências: 9,   CiênciasHum: null, CiênciasNat: 9.5, EducaçãoFísica: 10,  Geografia: 8.5, História: 8.5, LetMat: null, LitArteMov: null, LingEspanhola: 9,   LingInglesa: 9.5,  LingPortuguesa: 8.5, Matemática: 7.5, MatemáticaRA: null, LingPortLitProd: 8.5, TecnologiaCidadania: null },
  { nome: 'MARIA HELOISA NASCIMENTO BARBOSA',             ApoioOrient: null, Arte: 10.8, Ciências: 9,   CiênciasHum: null, CiênciasNat: 9.5, EducaçãoFísica: 12,  Geografia: 10,  História: 9.5, LetMat: 9.5, LitArteMov: 12,  LingEspanhola: null, LingInglesa: null,  LingPortuguesa: 7.5, Matemática: 8.5, MatemáticaRA: null, LingPortLitProd: 7.5, TecnologiaCidadania: null },
  { nome: 'MIGUEL LINO DOS SANTOS KINOSITA',              ApoioOrient: null, Arte: 8.5,  Ciências: 8,   CiênciasHum: null, CiênciasNat: 9.5, EducaçãoFísica: 9.5, Geografia: 9.5, História: 9.5, LetMat: 8.5, LitArteMov: 8,   LingEspanhola: 8.5, LingInglesa: null,  LingPortuguesa: 7.5, Matemática: 7.5, MatemáticaRA: null, LingPortLitProd: 7.5, TecnologiaCidadania: null },
  { nome: 'MILENA MEDEIRO LIMA',                          ApoioOrient: null, Arte: 9.5,  Ciências: null,CiênciasHum: null, CiênciasNat: null, EducaçãoFísica: null, Geografia: null,História: 7.5, LetMat: null, LitArteMov: null, LingEspanhola: null, LingInglesa: null,  LingPortuguesa: null, Matemática: null,MatemáticaRA: null, LingPortLitProd: null, TecnologiaCidadania: null },
  { nome: 'MIRELLA DE SOUZA CONCEIÇÃO',                   ApoioOrient: null, Arte: 7.5,  Ciências: 6,   CiênciasHum: null, CiênciasNat: 9,   EducaçãoFísica: 7,   Geografia: 10,  História: 7.5, LetMat: 8.5, LitArteMov: 8.5, LingEspanhola: null, LingInglesa: null,  LingPortuguesa: 8.5, Matemática: 5.5, MatemáticaRA: null, LingPortLitProd: 8.5, TecnologiaCidadania: null },
  { nome: 'RAY FELIPE BATISTA GOMES',                     ApoioOrient: null, Arte: 6.5,  Ciências: null,CiênciasHum: null, CiênciasNat: null, EducaçãoFísica: null, Geografia: null,História: null, LetMat: null, LitArteMov: null, LingEspanhola: null, LingInglesa: null,  LingPortuguesa: null, Matemática: null,MatemáticaRA: null, LingPortLitProd: null, TecnologiaCidadania: null },
  { nome: 'SARA DIAS DE ALMEIDA',                         ApoioOrient: 'SN',Arte: null,  Ciências: null,CiênciasHum: null, CiênciasNat: null, EducaçãoFísica: null,Geografia: null,História: null, LetMat: null, LitArteMov: null, LingEspanhola: null, LingInglesa: null,  LingPortuguesa: null, Matemática: null,MatemáticaRA: null, LingPortLitProd: null, TecnologiaCidadania: null },
  { nome: 'SOFIA BARBOSA BORGES DA SILVA',                ApoioOrient: null, Arte: 8.5,  Ciências: 9,   CiênciasHum: null, CiênciasNat: 8,   EducaçãoFísica: 10,  Geografia: 9.2, História: 8.5, LetMat: 9,   LitArteMov: 9,   LingEspanhola: null, LingInglesa: null,  LingPortuguesa: 9,   Matemática: 9,   MatemáticaRA: null, LingPortLitProd: 9, TecnologiaCidadania: null },
  { nome: 'SOFIA BEATRIZ DA SILVA RIBEIRO',               ApoioOrient: null, Arte: 7,    Ciências: 8,   CiênciasHum: null, CiênciasNat: 8.5, EducaçãoFísica: null, Geografia: null, História: 8.2, LetMat: null, LitArteMov: null, LingEspanhola: null, LingInglesa: null,  LingPortuguesa: null, Matemática: null,MatemáticaRA: null, LingPortLitProd: null, TecnologiaCidadania: null },
  { nome: 'VINICIUS FERREIRA RODRIGUES',                  ApoioOrient: null, Arte: null,  Ciências: null,CiênciasHum: null, CiênciasNat: null, EducaçãoFísica: null,Geografia: null,História: null, LetMat: null, LitArteMov: null, LingEspanhola: null, LingInglesa: null,  LingPortuguesa: null, Matemática: null,MatemáticaRA: null, LingPortLitProd: null, TecnologiaCidadania: null },
  { nome: 'BEATRIZ SILVA CIMATTI',                        ApoioOrient: null, Arte: 6,    Ciências: 7.5, CiênciasHum: null, CiênciasNat: 7,   EducaçãoFísica: null, Geografia: 6,   História: 6.2, LetMat: null, LitArteMov: 9,   LingEspanhola: null, LingInglesa: null,  LingPortuguesa: null, Matemática: null,MatemáticaRA: null, LingPortLitProd: null, TecnologiaCidadania: null },
  { nome: 'JOÃO MIGUEL ANASTACIO DE ASSIS',               ApoioOrient: 'SN',Arte: 6,    Ciências: 6,   CiênciasHum: null, CiênciasNat: 6.2, EducaçãoFísica: 6.5, Geografia: 7,   História: 9,   LetMat: null, LitArteMov: null, LingEspanhola: 6,   LingInglesa: null,  LingPortuguesa: 9,   Matemática: 4.5, MatemáticaRA: null, LingPortLitProd: 9, TecnologiaCidadania: null },
  { nome: 'ISABELLY VITÓRIA MELGAR RIBEIRO',              ApoioOrient: null, Arte: 6,    Ciências: 7,   CiênciasHum: null, CiênciasNat: 9,   EducaçãoFísica: 9,   Geografia: 8.5, História: 9,   LetMat: 9,   LitArteMov: 9.5, LingEspanhola: null, LingInglesa: null,  LingPortuguesa: null, Matemática: null,MatemáticaRA: null, LingPortLitProd: null, TecnologiaCidadania: null },
  { nome: 'YASMIN VALENTINA PINHEIRO DA SILVA',           ApoioOrient: null, Arte: 6,    Ciências: null,CiênciasHum: null, CiênciasNat: null, EducaçãoFísica: null, Geografia: null,História: null, LetMat: null, LitArteMov: null, LingEspanhola: null, LingInglesa: null,  LingPortuguesa: null, Matemática: null,MatemáticaRA: null, LingPortLitProd: null, TecnologiaCidadania: null },
];

// IMAGE 2: 7º Ano A
// Cols: ApoioOrient | Arte | Ciências | CiênciasHum | CiênciasNat | Nota | EducFísica | EnsinoReligioso | Geografia | Música | Letramento | LingPortLitProd | LiteraturasArte | LingEsp | LingInglesa | LingPort | Matemática | MatemáticaF | LingPortuguesaRA | TecnologiaC | Faltas
const grades7A = [
  { nome: 'ANA CARLA BATISTA NASCIMENTO',            ApoioOrient: null, Arte: 7.5, Ciências: null, CiênciasNat: null, EducaçãoFísica: null, EnsinoReligioso: null, Geografia: 9.5, História: null, LetMat: null, LitArteMov: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaRA: null, TecnologiaCidadania: null },
  { nome: 'ARON TALGATTI DOS SANTOS',                ApoioOrient: null, Arte: 10,  Ciências: 8,    CiênciasNat: null, EducaçãoFísica: null, EnsinoReligioso: null, Geografia: 10,  História: null, LetMat: null, LitArteMov: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: 7.5, LingPortLitProd: null, Matemática: null, MatemáticaRA: null, TecnologiaCidadania: null },
  { nome: 'BRENDA DE OLIVEIRA ROCHA',                ApoioOrient: 'SN',Arte: null, Ciências: null, CiênciasNat: null, EducaçãoFísica: null, EnsinoReligioso: null, Geografia: null,  História: null, LetMat: null, LitArteMov: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaRA: null, TecnologiaCidadania: null },
  { nome: 'BRENO GUSTAVO VALEJO DA SILVA',           ApoioOrient: null, Arte: 9,   Ciências: 8,    CiênciasNat: null, EducaçãoFísica: 9.5, EnsinoReligioso: null, Geografia: 10,  História: null, LetMat: null, LitArteMov: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: 6.5, LingPortLitProd: null, Matemática: null, MatemáticaRA: null, TecnologiaCidadania: null },
  { nome: 'BRUNO GABRIEL NASCIMENTO DE ALMEIDA',     ApoioOrient: null, Arte: 10,  Ciências: 8,    CiênciasNat: null, EducaçãoFísica: null, EnsinoReligioso: null, Geografia: 9.5, História: null, LetMat: null, LitArteMov: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaRA: null, TecnologiaCidadania: null },
  { nome: 'CLARA VITÓRIA VIEIRA GIMENEZ DE CARVALHO',ApoioOrient: 'SN',Arte: null, Ciências: null, CiênciasNat: null, EducaçãoFísica: null, EnsinoReligioso: null, Geografia: null,  História: null, LetMat: null, LitArteMov: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaRA: null, TecnologiaCidadania: null },
  { nome: 'DANILO NUNES DOS SANTOS',                 ApoioOrient: null, Arte: 10,  Ciências: 8,    CiênciasNat: null, EducaçãoFísica: 10,  EnsinoReligioso: null, Geografia: 10,  História: null, LetMat: null, LitArteMov: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaRA: null, TecnologiaCidadania: null },
  { nome: 'EMANUELLY LIMA DA SILVA DE SOUZA',        ApoioOrient: null, Arte: null, Ciências: null, CiênciasNat: null, EducaçãoFísica: 10,  EnsinoReligioso: null, Geografia: null,  História: null, LetMat: null, LitArteMov: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaRA: null, TecnologiaCidadania: null },
  { nome: 'EMILI DE DEUS DA SILVA',                  ApoioOrient: 'SN',Arte: null, Ciências: null, CiênciasNat: null, EducaçãoFísica: null, EnsinoReligioso: null, Geografia: null,  História: null, LetMat: null, LitArteMov: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaRA: null, TecnologiaCidadania: null },
  { nome: 'ESTEFANY VIEIRA RODRIGUES',               ApoioOrient: null, Arte: 9.5, Ciências: 8,    CiênciasNat: null, EducaçãoFísica: 8.5, EnsinoReligioso: null, Geografia: 9.5, História: null, LetMat: null, LitArteMov: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: 8.5, LingPortLitProd: null, Matemática: null, MatemáticaRA: null, TecnologiaCidadania: null },
  { nome: 'GIOVANI COURA DE CASTRO',                 ApoioOrient: null, Arte: 9.5, Ciências: 8,    CiênciasNat: null, EducaçãoFísica: 9.5, EnsinoReligioso: null, Geografia: 9.5, História: null, LetMat: null, LitArteMov: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaRA: null, TecnologiaCidadania: null },
  { nome: 'GUILHERME DENIZ DE FREITAS',              ApoioOrient: null, Arte: null, Ciências: null, CiênciasNat: null, EducaçãoFísica: null, EnsinoReligioso: null, Geografia: null,  História: null, LetMat: null, LitArteMov: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaRA: null, TecnologiaCidadania: null },
  { nome: 'HENRIQUE  ECHEVERRIA DE MATOS',           ApoioOrient: null, Arte: null, Ciências: null, CiênciasNat: null, EducaçãoFísica: null, EnsinoReligioso: null, Geografia: null,  História: null, LetMat: null, LitArteMov: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaRA: null, TecnologiaCidadania: null },
  { nome: 'IRIS DALIANA NOGUEIRA DOS SANTOS',        ApoioOrient: 'SN',Arte: 10,  Ciências: 8.5,  CiênciasNat: null, EducaçãoFísica: 9.5, EnsinoReligioso: null, Geografia: 10,  História: null, LetMat: null, LitArteMov: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaRA: null, TecnologiaCidadania: null },
  { nome: 'ISADORA JULIA BRITO DE SOUZA',            ApoioOrient: null, Arte: 10,  Ciências: 8.5,  CiênciasNat: null, EducaçãoFísica: 12,  EnsinoReligioso: null, Geografia: 10,  História: null, LetMat: null, LitArteMov: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaRA: null, TecnologiaCidadania: null },
  { nome: 'JAQUELYNE LINCHE DE OLIVEIRA',            ApoioOrient: null, Arte: 8.5, Ciências: 6,    CiênciasNat: null, EducaçãoFísica: 9.5, EnsinoReligioso: null, Geografia: 9.5, História: null, LetMat: null, LitArteMov: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: 7.5, LingPortLitProd: null, Matemática: null, MatemáticaRA: null, TecnologiaCidadania: null },
  { nome: 'JOÃO GABRIEL FERNANDES DUDU FERREIRA',    ApoioOrient: null, Arte: 6.5, Ciências: 7.5,  CiênciasNat: null, EducaçãoFísica: 7.5, EnsinoReligioso: null, Geografia: 9,   História: null, LetMat: null, LitArteMov: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: 6.5, LingPortLitProd: null, Matemática: null, MatemáticaRA: null, TecnologiaCidadania: null },
  { nome: 'JOÃO PAULO GONÇALVES PEREIRA',            ApoioOrient: null, Arte: 8.5, Ciências: 6.5,  CiênciasNat: null, EducaçãoFísica: 6.5, EnsinoReligioso: null, Geografia: 9,   História: null, LetMat: null, LitArteMov: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: 6.5, LingPortLitProd: null, Matemática: null, MatemáticaRA: null, TecnologiaCidadania: null },
  { nome: 'JOSÉ MARIA DOS SANTOS NETO',              ApoioOrient: null, Arte: 9.5, Ciências: 9.5,  CiênciasNat: null, EducaçãoFísica: 9.5, EnsinoReligioso: null, Geografia: 9.5, História: null, LetMat: null, LitArteMov: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: 9,   LingPortLitProd: null, Matemática: null, MatemáticaRA: null, TecnologiaCidadania: null },
  { nome: 'LAVÍNIA CASSIMIRO DEL GRANDE',            ApoioOrient: null, Arte: null, Ciências: null, CiênciasNat: null, EducaçãoFísica: null, EnsinoReligioso: null, Geografia: null,  História: null, LetMat: null, LitArteMov: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaRA: null, TecnologiaCidadania: null },
  { nome: 'LAYS BÁRBARA RODRIGUES ARRUDA',           ApoioOrient: null, Arte: null, Ciências: null, CiênciasNat: null, EducaçãoFísica: 4.5, EnsinoReligioso: null, Geografia: null,  História: null, LetMat: null, LitArteMov: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaRA: null, TecnologiaCidadania: null },
  { nome: 'MARIANA ROMERO OVANDO',                  ApoioOrient: 'SN',Arte: 10,  Ciências: 10,   CiênciasNat: null, EducaçãoFísica: 10,  EnsinoReligioso: null, Geografia: 10,  História: null, LetMat: null, LitArteMov: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: 10,  LingPortLitProd: null, Matemática: null, MatemáticaRA: null, TecnologiaCidadania: null },
  { nome: 'MIGUEL PALAZZINI DE BRITO CARDOSO SANTOS',ApoioOrient: null, Arte: null, Ciências: null, CiênciasNat: null, EducaçãoFísica: null, EnsinoReligioso: null, Geografia: null,  História: null, LetMat: null, LitArteMov: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaRA: null, TecnologiaCidadania: null },
  { nome: 'NATAN LUCAS DA SILVA GENEROSO',           ApoioOrient: null, Arte: 7,   Ciências: 6.5,  CiênciasNat: null, EducaçãoFísica: 6,   EnsinoReligioso: null, Geografia: 9,   História: null, LetMat: null, LitArteMov: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaRA: null, TecnologiaCidadania: null },
  { nome: 'NATHALY GABRIELY GALVÃO DUARTE',          ApoioOrient: null, Arte: 7,   Ciências: 6.5,  CiênciasNat: null, EducaçãoFísica: 6,   EnsinoReligioso: null, Geografia: 9,   História: null, LetMat: null, LitArteMov: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaRA: null, TecnologiaCidadania: null },
  { nome: 'OLAVO SOUZA MEDINA',                     ApoioOrient: null, Arte: null, Ciências: null, CiênciasNat: null, EducaçãoFísica: null, EnsinoReligioso: null, Geografia: null,  História: null, LetMat: null, LitArteMov: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaRA: null, TecnologiaCidadania: null },
  { nome: 'PEDRO LIMA FLORES',                      ApoioOrient: null, Arte: 5,   Ciências: 7.5,  CiênciasNat: null, EducaçãoFísica: 7.5, EnsinoReligioso: null, Geografia: 9,   História: null, LetMat: null, LitArteMov: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaRA: null, TecnologiaCidadania: null },
  { nome: 'RENATO AUGUSTO CONSOLARO DE OLIVEIRA',   ApoioOrient: null, Arte: null, Ciências: null, CiênciasNat: null, EducaçãoFísica: null, EnsinoReligioso: null, Geografia: null,  História: null, LetMat: null, LitArteMov: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaRA: null, TecnologiaCidadania: null },
  { nome: 'VICTOR HUGO BENITES PEREIRA SILVA',      ApoioOrient: null, Arte: null, Ciências: null, CiênciasNat: null, EducaçãoFísica: null, EnsinoReligioso: null, Geografia: null,  História: null, LetMat: null, LitArteMov: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaRA: null, TecnologiaCidadania: null },
  { nome: 'YAHN KALLEB BARBOSA DE OLIVEIRA',        ApoioOrient: null, Arte: null, Ciências: null, CiênciasNat: null, EducaçãoFísica: null, EnsinoReligioso: null, Geografia: null,  História: null, LetMat: null, LitArteMov: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaRA: null, TecnologiaCidadania: null },
  { nome: 'SOFIA MARQUES FERRAZ',                   ApoioOrient: null, Arte: null, Ciências: null, CiênciasNat: null, EducaçãoFísica: null, EnsinoReligioso: null, Geografia: null,  História: null, LetMat: null, LitArteMov: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaRA: null, TecnologiaCidadania: null },
];

// IMAGES 3 & 4: 1º Ano A (Ensino Médio)
// Cols: ApoioOrient | Arte | Biologia | CiênciasHum | CiênciasNat | Nota | EducFísica | EnsinoRel | Geografia | História | Letramento | LingPortLitProd | LiterArte | LingEsp | LingIngl | LingPort | Matemática | MatGeo | LingPortRA | TecnologiaC | Faltas
const grades1A = [
  { nome: 'ANA CLARA PAIVA VAZ',                    ApoioOrient: 'SN', Arte: 7.5,  Biologia: 8.5, EducaçãoFísica: null, EnsinoReligioso: null, Geografia: 8.5, História: 9,    LingEspanhola: 8.5, LingInglesa: 8.5, LingPortuguesa: null, LingPortLitProd: 8.5, Matemática: null, MatemáticaGeo: null, TecnologiaCidadania: 8 },
  { nome: 'ANA LUIZA DOS SANTOS BRUM',              ApoioOrient: null, Arte: null,  Biologia: null, EducaçãoFísica: null, EnsinoReligioso: null, Geografia: null, História: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaGeo: null, TecnologiaCidadania: null },
  { nome: 'BEATRIZ MALTA DE ALMEIDA FERNANDES VIANA',ApoioOrient: 'SN',Arte: 8,    Biologia: 7,   EducaçãoFísica: 10,  EnsinoReligioso: null, Geografia: 9,   História: 9.5,  LingEspanhola: 8,   LingInglesa: 7.5, LingPortuguesa: null, LingPortLitProd: 7,   Matemática: null, MatemáticaGeo: null, TecnologiaCidadania: null },
  { nome: 'DANIELLA DE ALMEIDA RODRIGUES',           ApoioOrient: null, Arte: 7.5,  Biologia: 8,   EducaçãoFísica: null, EnsinoReligioso: null, Geografia: 7,   História: 9,    LingEspanhola: 8,   LingInglesa: 7.5, LingPortuguesa: null, LingPortLitProd: 8,   Matemática: null, MatemáticaGeo: null, TecnologiaCidadania: null },
  { nome: 'DAVI ALEXANDRE XAVIER DINIZ',             ApoioOrient: null, Arte: null,  Biologia: null, EducaçãoFísica: null, EnsinoReligioso: null, Geografia: null, História: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaGeo: null, TecnologiaCidadania: null },
  { nome: 'FELLIPE FRANCISCO DEGAN DE MIRANDA',      ApoioOrient: null, Arte: null,  Biologia: null, EducaçãoFísica: null, EnsinoReligioso: null, Geografia: null, História: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaGeo: null, TecnologiaCidadania: null },
  { nome: 'GABRIELE RORIZ PAES',                    ApoioOrient: null, Arte: null,  Biologia: null, EducaçãoFísica: null, EnsinoReligioso: null, Geografia: null, História: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaGeo: null, TecnologiaCidadania: null },
  { nome: 'GABRIELLE ALGIMIRO DA SILVA',             ApoioOrient: null, Arte: null,  Biologia: null, EducaçãoFísica: null, EnsinoReligioso: null, Geografia: null, História: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaGeo: null, TecnologiaCidadania: null },
  { nome: 'GUSTAVO DOS SANTOS MADIA',               ApoioOrient: null, Arte: null,  Biologia: null, EducaçãoFísica: null, EnsinoReligioso: null, Geografia: null, História: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaGeo: null, TecnologiaCidadania: null },
  { nome: 'GUSTAVO HENRIQUE DA SILVA PINHEIRO',     ApoioOrient: null, Arte: null,  Biologia: null, EducaçãoFísica: null, EnsinoReligioso: null, Geografia: null, História: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaGeo: null, TecnologiaCidadania: null },
  { nome: 'IZABELLA DA COSTA BARÔA DE CAMARGO',     ApoioOrient: null, Arte: null,  Biologia: null, EducaçãoFísica: null, EnsinoReligioso: null, Geografia: null, História: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaGeo: null, TecnologiaCidadania: null },
  { nome: 'JENNIFER MIGUEL ALVES',                  ApoioOrient: null, Arte: null,  Biologia: null, EducaçãoFísica: null, EnsinoReligioso: null, Geografia: null, História: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaGeo: null, TecnologiaCidadania: null },
  { nome: 'JULIANA DUARTE COENGA',                  ApoioOrient: null, Arte: null,  Biologia: null, EducaçãoFísica: null, EnsinoReligioso: null, Geografia: null, História: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaGeo: null, TecnologiaCidadania: null },
  { nome: 'JULIA RAMIRO DA SILVA',                  ApoioOrient: null, Arte: null,  Biologia: null, EducaçãoFísica: null, EnsinoReligioso: null, Geografia: null, História: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaGeo: null, TecnologiaCidadania: null },
  { nome: 'KARLOS RAFAEL DA ROSA SALES',            ApoioOrient: null, Arte: null,  Biologia: null, EducaçãoFísica: null, EnsinoReligioso: null, Geografia: null, História: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaGeo: null, TecnologiaCidadania: null },
  { nome: 'LUANNY LAVINIA CEGOVIA DE OLIVEIRA',     ApoioOrient: null, Arte: null,  Biologia: null, EducaçãoFísica: null, EnsinoReligioso: null, Geografia: null, História: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaGeo: null, TecnologiaCidadania: null },
  { nome: 'LUCAS GUTIERREZ NICOLAU',                ApoioOrient: null, Arte: null,  Biologia: null, EducaçãoFísica: null, EnsinoReligioso: null, Geografia: null, História: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaGeo: null, TecnologiaCidadania: null },
  { nome: 'MANUELLA SANTANA GOMES',                 ApoioOrient: null, Arte: null,  Biologia: null, EducaçãoFísica: null, EnsinoReligioso: null, Geografia: null, História: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaGeo: null, TecnologiaCidadania: null },
  { nome: 'MARCOS ALBERTO PARENTE LIDIO',           ApoioOrient: null, Arte: null,  Biologia: null, EducaçãoFísica: null, EnsinoReligioso: null, Geografia: null, História: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaGeo: null, TecnologiaCidadania: null },
  { nome: 'MARIA GABRIELA LEITE ARAGÃO',            ApoioOrient: null, Arte: null,  Biologia: null, EducaçãoFísica: null, EnsinoReligioso: null, Geografia: null, História: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaGeo: null, TecnologiaCidadania: null },
  { nome: 'MARIA JÚLIA DOS SANTOS',                 ApoioOrient: null, Arte: null,  Biologia: null, EducaçãoFísica: null, EnsinoReligioso: null, Geografia: null, História: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaGeo: null, TecnologiaCidadania: null },
  { nome: 'MATEUS DO NASCIMENTO CUELLAR',           ApoioOrient: null, Arte: null,  Biologia: null, EducaçãoFísica: null, EnsinoReligioso: null, Geografia: null, História: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaGeo: null, TecnologiaCidadania: null },
  { nome: 'MATHEUS ALVES BENTO GOMES',              ApoioOrient: null, Arte: null,  Biologia: null, EducaçãoFísica: null, EnsinoReligioso: null, Geografia: null, História: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaGeo: null, TecnologiaCidadania: null },
  { nome: 'MIGUEL GUSTAVO BARBOSA COSTA',           ApoioOrient: null, Arte: null,  Biologia: null, EducaçãoFísica: null, EnsinoReligioso: null, Geografia: null, História: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaGeo: null, TecnologiaCidadania: null },
  { nome: 'MURILLO SOUZA DA SILVA',                 ApoioOrient: null, Arte: null,  Biologia: null, EducaçãoFísica: null, EnsinoReligioso: null, Geografia: null, História: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaGeo: null, TecnologiaCidadania: null },
  { nome: 'NICOLAS GABRIEL ARMÔA FERNANDES',        ApoioOrient: null, Arte: null,  Biologia: null, EducaçãoFísica: null, EnsinoReligioso: null, Geografia: null, História: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaGeo: null, TecnologiaCidadania: null },
  { nome: 'RAFAEL PINHEIRO PADILHA',                ApoioOrient: null, Arte: null,  Biologia: null, EducaçãoFísica: null, EnsinoReligioso: null, Geografia: null, História: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaGeo: null, TecnologiaCidadania: null },
  { nome: 'SARAH SILVA DE OLIVEIRA',                ApoioOrient: null, Arte: null,  Biologia: null, EducaçãoFísica: null, EnsinoReligioso: null, Geografia: null, História: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaGeo: null, TecnologiaCidadania: null },
  { nome: 'SOPHIA PONTES DE OLIVEIRA CORREIA',      ApoioOrient: null, Arte: null,  Biologia: null, EducaçãoFísica: null, EnsinoReligioso: null, Geografia: null, História: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaGeo: null, TecnologiaCidadania: null },
  { nome: 'VICTOR HUGO BENITEZ',                    ApoioOrient: null, Arte: null,  Biologia: null, EducaçãoFísica: null, EnsinoReligioso: null, Geografia: null, História: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaGeo: null, TecnologiaCidadania: null },
  { nome: 'VICTOR OLIVEIRA BENITEZ',                ApoioOrient: null, Arte: null,  Biologia: null, EducaçãoFísica: null, EnsinoReligioso: null, Geografia: null, História: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaGeo: null, TecnologiaCidadania: null },
  { nome: 'VINÍCIUS KRUK CHAVES',                   ApoioOrient: null, Arte: null,  Biologia: null, EducaçãoFísica: null, EnsinoReligioso: null, Geografia: null, História: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaGeo: null, TecnologiaCidadania: null },
  { nome: 'VINÍCIUS PEREIRA DE LIMA',               ApoioOrient: null, Arte: null,  Biologia: null, EducaçãoFísica: null, EnsinoReligioso: null, Geografia: null, História: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaGeo: null, TecnologiaCidadania: null },
  { nome: 'VITOR HUGO DE CARVALHO PEREIRA RATIER ORTIZ', ApoioOrient: null, Arte: null, Biologia: null, EducaçãoFísica: null, EnsinoReligioso: null, Geografia: null, História: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaGeo: null, TecnologiaCidadania: null },
  { nome: 'YASMIN SANTANA DE JESUS',                ApoioOrient: null, Arte: null,  Biologia: null, EducaçãoFísica: null, EnsinoReligioso: null, Geografia: null, História: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaGeo: null, TecnologiaCidadania: null },
  { nome: 'YASMIN VICTÓRIA IRALA VALENSUELLOS',     ApoioOrient: null, Arte: null,  Biologia: null, EducaçãoFísica: null, EnsinoReligioso: null, Geografia: null, História: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaGeo: null, TecnologiaCidadania: null },
  { nome: 'ANNA KETHELING FERNANDES',               ApoioOrient: null, Arte: null,  Biologia: null, EducaçãoFísica: null, EnsinoReligioso: null, Geografia: null, História: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaGeo: null, TecnologiaCidadania: null },
  { nome: 'KAUÃ FELIPE JACYNTHO CAVALCANTE',        ApoioOrient: null, Arte: null,  Biologia: null, EducaçãoFísica: null, EnsinoReligioso: null, Geografia: null, História: null, LingEspanhola: null, LingInglesa: null, LingPortuguesa: null, LingPortLitProd: null, Matemática: null, MatemáticaGeo: null, TecnologiaCidadania: null },
];

// Helper to normalize names for matching
function normalizeNome(n) {
  return n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
}

// Main function
async function importGrades(turmaId, turmaLabel, gradesData, discKeys) {
  console.log(`\n========== ${turmaLabel} ==========`);

  // Fetch students from DB
  const { data: dbAlunos } = await supabase.from('alunos').select('id, nome').eq('turma_id', turmaId);
  const alunoMap = {};
  dbAlunos.forEach(a => { alunoMap[normalizeNome(a.nome)] = a.id; });

  // Prepare avaliacoes and notas to insert
  const discNomesUsados = new Set();
  gradesData.forEach(row => {
    discKeys.forEach(dk => {
      const val = row[dk];
      if (val !== null && val !== 'SN' && val !== '-' && !isNaN(parseFloat(val))) {
        discNomesUsados.add(dk);
      }
    });
  });

  let totalInserted = 0;
  let totalSkipped = 0;

  for (const discKey of discNomesUsados) {
    const discId = DISC[discKey];
    if (!discId) { console.log('  DISC NOT FOUND:', discKey); continue; }

    // Check if avaliacao already exists
    const { data: existing } = await supabase.from('avaliacoes')
      .select('id')
      .eq('professor_id', ADMIN_PROF_ID)
      .eq('turma_id', turmaId)
      .eq('disciplina_id', discId)
      .eq('bimestre_id', BIMESTRE)
      .maybeSingle();

    let avaliacaoId;
    if (existing) {
      avaliacaoId = existing.id;
    } else {
      const { data: newAv, error: avErr } = await supabase.from('avaliacoes').insert({
        professor_id: ADMIN_PROF_ID,
        turma_id: turmaId,
        disciplina_id: discId,
        bimestre_id: BIMESTRE,
        nome: 'Média 1º Bimestre',
        valor_maximo: 10,
        publicada: true,
      }).select('id').single();
      if (avErr) { console.log('  ERROR creating avaliacao for', discKey, avErr.message); continue; }
      avaliacaoId = newAv.id;
    }

    // Insert notas
    const notasToInsert = [];
    for (const row of gradesData) {
      const rawNota = row[discKey];
      if (rawNota === null || rawNota === 'SN' || rawNota === '-') continue;
      const nota = parseFloat(rawNota);
      if (isNaN(nota)) continue;

      const alunoId = alunoMap[normalizeNome(row.nome)];
      if (!alunoId) {
        console.log(`  WARNING: Aluno not found: "${row.nome}" (${normalizeNome(row.nome)})`);
        totalSkipped++;
        continue;
      }

      notasToInsert.push({ avaliacao_id: avaliacaoId, aluno_id: alunoId, nota: Math.min(nota, 10) });
    }

    if (notasToInsert.length > 0) {
      // Upsert to avoid duplicates
      const { error: notaErr } = await supabase.from('notas_avaliacoes')
        .upsert(notasToInsert, { onConflict: 'avaliacao_id,aluno_id' });
      if (notaErr) {
        console.log(`  ERROR inserting notas for ${discKey}:`, notaErr.message);
      } else {
        console.log(`  ✓ ${discKey}: ${notasToInsert.length} notas inseridas`);
        totalInserted += notasToInsert.length;
      }
    }
  }

  console.log(`  TOTAL: ${totalInserted} notas inseridas, ${totalSkipped} alunos não encontrados`);
}

const discKeys6A = ['Arte','Ciências','EducaçãoFísica','Geografia','História','LetMat','LitArteMov','LingEspanhola','LingInglesa','LingPortuguesa','LingPortLitProd','Matemática','TecnologiaCidadania'];
const discKeys7A = ['Arte','Ciências','EducaçãoFísica','EnsinoReligioso','Geografia','História','LingEspanhola','LingInglesa','LingPortuguesa','LingPortLitProd','Matemática','TecnologiaCidadania'];
const discKeys1A = ['Arte','Biologia','EducaçãoFísica','EnsinoReligioso','Geografia','História','LingEspanhola','LingInglesa','LingPortuguesa','LingPortLitProd','Matemática','MatemáticaGeo','TecnologiaCidadania'];

await importGrades(TURMAS['6A'], '6º Ano A', grades6A, discKeys6A);
await importGrades(TURMAS['7A'], '7º Ano A', grades7A, discKeys7A);
await importGrades(TURMAS['1A'], '1º Ano A', grades1A, discKeys1A);

console.log('\n✅ Importação concluída!');
