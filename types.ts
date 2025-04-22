import { Timestamp } from "firebase/firestore";

export interface GroupData {
  id: string; // Adicionado para conveniência
  groupName?: string;
  inviteCode?: string;
  members?: string[];
  categories?: string[];
  createdAt?: Timestamp;
  // Adicione outros campos se houver
}

// Interface para Item (como antes)
export interface ShoppingListItemData {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  store?: string;
  estimatedValue?: number;
  category?: string;
  addedBy: string;
  addedAt: Timestamp;
  isBought: boolean;
  boughtAt?: Timestamp | null;
  boughtBy?: string | null;
  linkedTransactionId?: string | null;
}

// Interface para Resumo da Lista
export interface ShoppingListSummary {
    percentageBought: number;
    totalEstimatedValue: number;
}

// Interface para Lista de Compras (agora pode incluir resumo opcional)
export interface ShoppingList {
  id: string;
  name: string;
  archived: boolean;
  createdAt: Timestamp;
  summary?: ShoppingListSummary; // <-- Resumo calculado opcionalmente
}

// --- Interface para Transações ---
export interface Transaction {
  id: string;
  value: number;
  type: 'income' | 'expense';
  description?: string;
  category: string;
  userId: string;
  date: Timestamp; // Mantém como Timestamp para queries
  groupId: string;
  createdAt: Timestamp;
}

export interface InventoryItemData {
  id: string;
  name: string;               // Nome do produto
  quantity: number;           // Quantidade atual em estoque
  unit: string;               // Unidade (un, kg, L, etc.)
  category?: string;           // Categoria (opcional)
  lastPurchaseDate?: Timestamp | null; // Data da última adição/compra
  lastPurchaseValue?: number | null;  // Valor total pago na última compra dessa qtde
  lastPurchaseQuantity?: number | null; // Quantidade comprada na última vez
  nextPurchaseDate?: Timestamp | null;  // Data estimada da próxima compra (opcional)
  nextPurchaseValue?: number | null;   // Valor estimado da próxima compra (opcional)
  addedAt: Timestamp;         // Quando foi adicionado pela primeira vez
  updatedAt?: Timestamp;        // Quando foi atualizado pela última vez
  addedBy: string;            // Quem adicionou primeiro
  lastUpdatedBy?: string;       // Quem atualizou por último
  groupId: string;            // Associado ao grupo (embora seja subcoleção)
  store: string;
  estimatedValue: number | null
}

// Orçamento Mensal (único tipo agora nesta tela)
export interface BudgetData {
  category: string;
  targetDate: any;
  id: string;
  name: string;           // Nome do orçamento (ex: "Supermercado + Feira")
  targetAmount: number;   // Limite de gasto para o período
  categories: string[];     // Array de categorias que este orçamento monitora
  monthYear: string;        // Mês/Ano de aplicação (formato "YYYY-MM")
  // Metadados
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  createdBy: string;
  type: 'monthly'; // Pode omitir se só tiver esse tipo agora, ou manter para futuro
  spentAmount: number;
}

// Tipo processado para exibição na lista, incluindo gasto calculado
export interface ProcessedBudgetData extends BudgetData {
    spentAmount: number; // Gasto total das categorias vinculadas no mês/ano do orçamento
}


// --- Interface para Resumos ---
export interface FinancialSummary {
  income: number;
  expenses: number;
  balance: number;
}