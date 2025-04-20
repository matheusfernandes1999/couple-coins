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

export interface BudgetData {
  id: string;                   // ID do documento no Firestore
  name: string;                 // Nome (Ex: "Alimentação", "Viagem Europa")
  type: 'monthly' | 'goal';     // Tipo: Orçamento mensal ou Meta de poupança
  targetAmount: number;         // Valor alvo (limite mensal ou total da meta)
  category?: string | null;      // Categoria associada (APENAS para type='monthly')
  monthYear?: string | null;     // Mês/Ano (YYYY-MM) (APENAS para type='monthly')
  amountSaved?: number;          // Valor guardado até agora (APENAS para type='goal', default 0)
  targetDate?: Timestamp | null; // Data alvo (APENAS para type='goal', opcional)
  createdAt: Timestamp;         // Quando foi criado
  // Opcional: Campos de arquivamento/status
  // isArchived?: boolean;
  // isCompleted?: boolean;
}

// --- Interface para Resumos ---
export interface FinancialSummary {
  income: number;
  expenses: number;
  balance: number;
}