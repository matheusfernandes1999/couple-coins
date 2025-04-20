// utils/helpers.ts

// --- Funções Auxiliares de Data ---

/**
 * Retorna o ano e mês de uma data no formato YYYY-MM.
 * @param date Objeto Date.
 * @returns String no formato YYYY-MM.
 */
export const getMonthYear = (date: Date): string => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
  };
  
  /**
   * Calcula o início (Segunda-feira 00:00:00) e o fim (Domingo 23:59:59) da semana para uma data específica.
   * @param date Objeto Date dentro da semana desejada.
   * @returns Objeto com as datas 'start' e 'end' da semana.
   */
  export const getWeekRange = (date: Date): { start: Date, end: Date } => {
    const startOfWeek = new Date(date);
    const day = startOfWeek.getDay(); // 0 = Domingo, 1 = Segunda...
  
    // Ajusta para a semana começar na Segunda-feira
    // Se for Domingo (0), volta 6 dias. Se for outro dia, volta (day - 1) dias.
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0); // Início do dia (00:00:00)
  
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Adiciona 6 dias para chegar ao Domingo
    endOfWeek.setHours(23, 59, 59, 999); // Fim do dia (23:59:59.999)
  
    return { start: startOfWeek, end: endOfWeek };
  };
  
  
  // --- Função de Geração de Código ---
  // (Considerar mover para um utils/groupUtils.ts se tiver mais funções relacionadas a grupos)
  
  /**
   * Gera um código alfanumérico aleatório de 6 caracteres em maiúsculas.
   * ATENÇÃO: Esta é uma função MOCK e NÃO CRIPTOGRAFICAMENTE SEGURA para códigos reais.
   * Use bibliotecas adequadas ou geração no backend para produção.
   * @returns String com o código gerado.
   */
  export const generateInviteCode = (): string => {
      const length = 6;
      const characters = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789'; // Evita O e 0 para clareza
      let result = '';
      const charactersLength = characters.length;
      for ( let i = 0; i < length; i++ ) {
          result += characters.charAt(Math.floor(Math.random() * charactersLength));
      }
      return result;
      // Alternativa mais curta anterior:
      // return Math.random().toString(36).substring(2, 8).toUpperCase();
  };