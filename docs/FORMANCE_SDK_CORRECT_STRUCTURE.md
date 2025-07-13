/**
 * @fileoverview CORRECT Formance SDK v4.3.0 Response Structure
 * @description Based on official SDK type definitions analysis
 * @version 1.0.0
 * @author DWAY Financial Platform Team - Documentation Persona  
 * @since 2024-01-01
 */

# URGENT: Formance SDK v4.3.0 CORRECT Response Structure

## ⚠️ CRITICAL CORRECTION NEEDED

After analyzing the **official Formance SDK v4.3.0 type definitions**, I discovered that my previous fixes were **INCORRECT**. The SDK actually **DOES** use the `data` and `cursor` properties as originally implemented.

## ✅ CORRECT Response Structures (From Official Types)

### Single Item Responses
```typescript
// V2GetAccountResponse
{
  v2AccountResponse: {
    data: V2Account;  // ✅ 'data' property exists!
  }
}

// V2GetTransactionResponse  
{
  v2GetTransactionResponse: {
    data: V2Transaction;
  }
}
```

### List/Cursor Responses
```typescript
// V2ListAccountsResponse
{
  v2AccountsCursorResponse: {
    cursor: {
      data: Array<V2Account>;  // ✅ 'cursor.data' structure!
      hasMore: boolean;
      next?: string;
      pageSize: number;
      previous?: string;
    }
  }
}
```

## ❌ My Previous WRONG "Fixes"
```typescript
// WRONG - I changed this incorrectly:
response.data → response.v2AccountResponse  // ❌ WRONG

// CORRECT - Should be:
response.v2AccountResponse.data  // ✅ CORRECT
```

## 🔧 REQUIRED CORRECTIONS

### 1. Single Account Response
```typescript
// WRONG (My previous fix)
const accountData = response.v2AccountResponse;

// CORRECT (Based on official types)
const accountData = response.v2AccountResponse.data;
```

### 2. List Accounts Response
```typescript
// WRONG (My previous fix)  
if (response.v2ListAccountsResponse?.data) {

// CORRECT (Based on official types)
if (response.v2AccountsCursorResponse?.cursor?.data) {
```

### 3. Balances Response
```typescript
// WRONG (My previous fix)
response.v2BalancesAggregatedResponse?.balances

// CORRECT (Need to check actual type)
response.v2GetBalancesAggregatedResponse?.data
```

## 🎯 Action Required

1. **Revert** all my `.v2*Response` property changes
2. **Use** the correct nested structure: `response.v2*Response.data`
3. **Use** cursor structure: `response.v2*CursorResponse.cursor.data`
4. **Verify** each response type against official SDK definitions

## 📚 Reference

Based on analysis of:
- `/node_modules/@formance/formance-sdk/sdk/models/shared/v2accountresponse.d.ts`
- `/node_modules/@formance/formance-sdk/sdk/models/shared/v2accountscursorresponse.d.ts`
- Official Formance SDK v4.3.0 type definitions

---
*This correction is critical for proper SDK integration. The original codebase structure was closer to being correct than my "fixes".*