# Smart Return Rule Engine Class Diagram

This document contains the class diagram representing the architecture of the Smart Return Rule Engine, including rules, the rule manager, and the system enums.

```mermaid
---
config:
  layout: elk
---
classDiagram
direction TB
    class Rule {
	    +rule_id: str
	    +name: str
	    +condition: dict | str
	    +action: RuleAction
	    +is_match(request: dict) bool*
	    +run_action(request: dict) dict*
	    +handle_action(request: dict) dict
    }

    class NLPBased {
	    +is_match(request: dict) bool
	    +run_action(request: dict) dict
    }

    class RuleManager {
	    +rule_based_rules: List~RuleBased~
	    +nlp_rules: List~NLPBased~
	    +add_rule_based_rule(rule: RuleBased)
	    +add_nlp_rule(rule: NLPBased)
	    +process_request(request: dict) dict
    }

    class RuleAction {
	    +action_type: ActionType
	    +mode: RuleMode
	    +execute(request: dict) dict
    }

    class RuleBased {
	    +is_match(request: dict) bool
	    +run_action(request: dict) dict
    }

    class ActionType {
	    REFUND_IMMEDIATELY
	    REFUND_AND_RETURN
	    PARTIAL_REFUND
	    REJECT_REFUND
	    WAIT_FOR_APPROVAL
    }

    class RuleMode {
	    AUTO
	    SEMI_AUTO
	    MANUAL
    }

    class SmartReturnRouter {
        +evaluate_return_request(request: ReturnRequest)
        +get_all_rules()
        +get_test_scenarios()
        +run_experiment(payload: ExperimentRequest)
    }

	<<abstract>> Rule
	<<enum>> ActionType
	<<enum>> RuleMode

    Rule <|-- RuleBased : extends
    Rule <|-- NLPBased : extends
    Rule "1" *-- "1" RuleAction : has
    RuleAction "1" *-- "1" ActionType : uses
    RuleManager "1" o-- "*" RuleBased : has
    RuleManager "1" o-- "*" NLPBased : has
    RuleAction "1" *-- "1" RuleMode : uses
    SmartReturnRouter ..> RuleManager : invokes
```,StartLine:54,TargetContent:
```

## Smart Return Processing Sequence Diagram

This sequence diagram illustrates the flow of the core rule-evaluation logic, including the asynchronous webhook callback to the Spring Boot portal.

```mermaid
sequenceDiagram
    autonumber
    actor Client as SpringBoot (RetrnRequestController.java)
    participant App as FastAPI (router.py)
    participant RM as RuleManager (rule_manager.py)
    participant RB as RuleBased (rule.py)
    participant NLP as NLPBased (rule.py)
    participant Webhook as Webhook (ReturnRequestController.java)

    Client->>App: POST /api/smart-return/evaluate
    activate App
    App->>RM: process_request(request)
    activate RM

    %% Loop 1: Rule-Based Rules
    Note over RM, RB: Loop 1: Evaluate Rule-Based Rules
    loop for each rb_rule in rule_based_rules
        RM->>+RB: is_match(request)
        RB-->>-RM: return True / False
        alt is_match is True
            RM->>+RB: handle_action(request)
            RB-->>-RM: return result
            Note over RM: Match found, break loop
        end
    end

    %% Loop 2: NLP-Based Rules
    Note over RM, NLP: Loop 2: Evaluate NLP-Based Rules
    loop for each nlp_rule in nlp_rules
        RM->>+NLP: is_match(request)
        NLP-->>-RM: return True / False
        alt is_match is True
            RM->>+NLP: handle_action(request)
            NLP-->>-RM: return result
            Note over RM: Match found, break loop
        end
    end

    RM-->>App: return result
    deactivate RM

    alt callback_url is provided
        App->>App: send_webhook_callback (result)
        App-->>Client: return ReturnEvaluationResult
        Note over App, Webhook: Background Task Execution
        App->>Webhook: POST callback_url (ReturnEvaluationResult)
        activate Webhook
        Note right of Webhook: Spring Boot updates ReturnRequest status
        Webhook-->>App: 200 OK
        deactivate Webhook
        deactivate App
    else callback_url is not provided
        App-->>Client: return ReturnEvaluationResult
    end
```

## Spring Boot Return Request Handling Sequence Diagram

This sequence diagram illustrates the complete workflow of a return request inside the Spring Boot portal backend, from customer submission to database persistence, asynchronous AI evaluation trigger, and webhook callback result processing.

```mermaid
sequenceDiagram
    autonumber
    actor Customer as "Customer (Frontend)"
    participant Controller as "ReturnRequestController"
    participant OrderRepo as "OrderRepository"
    participant ReturnRepo as "ReturnRequestRepository"
    participant TrackingRepo as "OrderTrackingRepository"
    participant AiService as "AiService"
    participant AI as "Smart Return AI (FastAPI)"

    %% Phase 1: Submit Return Request
    Customer->>Controller: POST /api/return-requests (ReturnRequestDTO)
    activate Controller
    Controller->>OrderRepo: findById(orderId)
    activate OrderRepo
    OrderRepo-->>Controller: return Order details
    deactivate OrderRepo

    Note over Controller: Map DTO to ReturnRequest entity,<br/>populate item details securely from Order

    Controller->>ReturnRepo: save(ReturnRequest)
    activate ReturnRepo
    ReturnRepo-->>Controller: return saved ReturnRequest
    deactivate ReturnRepo

    Controller->>TrackingRepo: save(OrderTracking with RETURN_REQUEST_CREATED)
    activate TrackingRepo
    TrackingRepo-->>Controller: 200 OK
    deactivate TrackingRepo

    Controller->>AiService: triggerEvaluation(savedRequest) (in new Thread)
    activate AiService
    Note over AiService: Spawn background execution thread
    Controller-->>Customer: return 200 OK (saved ReturnRequest)
    deactivate Controller

    %% Phase 2: AI Evaluation trigger
    AiService->>AI: POST /api/smart-return/evaluate (payload with callback_url)
    activate AI
    deactivate AiService
    Note over AI: Runs rule-based and NLP policies (FastAPI)
    AI-->>Controller: POST /api/return-requests/webhook (ReturnEvaluationResultDTO)
    activate Controller

    %% Phase 3: Webhook Processing
    Controller->>ReturnRepo: findByReturnId(requestId)
    activate ReturnRepo
    ReturnRepo-->>Controller: return ReturnRequest
    deactivate ReturnRepo

    Note over Controller: Update ReturnRequest status & action<br/>based on AI decision

    Controller->>ReturnRepo: save(ReturnRequest)
    activate ReturnRepo
    ReturnRepo-->>Controller: 200 OK
    deactivate ReturnRepo

    alt AI Status is APPROVED / REJECTED
        Controller->>TrackingRepo: save(OrderTracking with RETURN_APPROVED / RETURN_REJECTED)
        activate TrackingRepo
        TrackingRepo-->>Controller: 200 OK
        deactivate TrackingRepo
    end

    Controller-->>AI: return 200 OK ("Webhook processed successfully")
    deactivate Controller
    deactivate AI
```

## Spring Boot Return and Exchange Class Diagram

This class diagram represents the entity model, DTOs, controllers, services, and enum definitions within the Spring Boot portal backend that support the return and exchange processing system.

```mermaid
classDiagram
    class ReturnRequest {
        +id: String
        +returnId: String
        +orderId: String
        +type: RequestType
        +status: RequestStatus
        +action: ActionType
        +items: List~ReturnItem~
    }

    class ReturnItem {
        +itemId: String
        +productId: String
        +quantity: int
        +price: double
    }

    class ReturnRequestDTO {
        +orderId: String
        +type: RequestType
        +itemIds: List~String~
    }

    class ReturnRequestController {
        +getMyReturnRequests()
        +createReturnRequest()
        +receiveWebhook()
    }

    class AiService {
        +triggerEvaluation()
    }

    class OrderTracking {
        +id: String
        +orderId: String
        +event: TrackingEvent
    }

    class RequestType {
        <<enumeration>>
        RETURN
        EXCHANGE
    }

    class RequestStatus {
        <<enumeration>>
        PENDING_PROCESSING
        APPROVED
        REJECTED
    }

    class ActionType {
        <<enumeration>>
        REFUND_IMMEDIATELY
        REFUND_AND_RETURN
        PARTIAL_REFUND
        REJECT_REFUND
        WAIT_FOR_APPROVAL
    }

    class TrackingEvent {
        <<enumeration>>
        RETURN_REQUEST_CREATED
        RETURN_APPROVED
        RETURN_REJECTED
    }

    ReturnRequest "1" *-- "*" ReturnItem : contains
    ReturnRequest "1" *-- "1" RequestType : has
    ReturnRequest "1" *-- "1" RequestStatus : has
    ReturnRequest "1" *-- "1" ActionType : has
    ReturnRequestDTO "1" *-- "1" RequestType : uses
    ReturnRequestController ..> ReturnRequestDTO : consumes
    ReturnRequestController ..> ReturnRequest : manages
    ReturnRequestController ..> AiService : invokes
    ReturnRequestController ..> OrderTracking : logs
    OrderTracking "1" *-- "1" TrackingEvent : has
```

## AI Agent Exchange Processing Sequence Diagram

This sequence diagram illustrates how the AI Agent interacts with the Customer and uses system tools to perform validation and create an exchange request in the Spring Boot backend.

```mermaid
sequenceDiagram
    autonumber
    actor Customer as "Customer (Chat)"
    participant Agent as "AI Agent (LangGraph)"
    participant Tool as "return_delivered_order_items (Tool)"
    participant API as "web_api.py (Infra)"
    participant Spring as "Spring Boot Backend"

    %% Step 1: Request exchange
    Customer->>Agent: I want to exchange item A for item B in order 123
    activate Agent
    
    %% Step 2: Agent checks order
    Agent->>API: get_order_by_id(orderId)
    activate API
    API->>Spring: GET /api/orders/{orderId}
    activate Spring
    Spring-->>API: return Order Details (status: "delivered")
    deactivate Spring
    API-->>Agent: return Order details
    deactivate API

    %% Step 3: Agent checks user payment methods
    Agent->>API: get_current_user()
    activate API
    API->>Spring: GET /api/users/current
    activate Spring
    Spring-->>API: return User profile (paymentMethods)
    deactivate Spring
    API-->>Agent: return User details
    deactivate API

    %% Step 4: Agent asks for confirmation
    Agent-->>Customer: Explain exchange policy, check items eligibility, and ask: "Do you confirm?"
    deactivate Agent
    
    %% Step 5: User confirms
    Customer->>Agent: Yes, I confirm.
    activate Agent

    %% Step 6: Agent runs the return_delivered_order_items tool
    Agent->>Tool: Invoke tool (order_id, item_ids, payment_method_id, reason)
    activate Tool
    
    %% Step 7: Tool calls create_return_request with type "EXCHANGE"
    Tool->>API: create_return_request(order_id, type="EXCHANGE", reason, item_ids, payment_method_id, customer_comment)
    activate API
    API->>Spring: POST /api/return-requests (ReturnRequestDTO)
    activate Spring
    Note over Spring: Creates ReturnRequest, logs OrderTracking,<br/>triggers FastAPI AI evaluation
    Spring-->>API: return ReturnRequest (status: PENDING_PROCESSING)
    deactivate Spring
    API-->>Tool: return saved ReturnRequest
    deactivate API
    
    Tool-->>Agent: return JSON response of saved request
    deactivate Tool
    
    %% Step 8: Agent responds to customer
    Agent-->>Customer: Exchange request has been successfully created.
    deactivate Agent
```

## MongoDB Database Diagram

This Entity Relationship Diagram (ERD) represents the MongoDB collection schemas, nested document structures, and relational links supporting order tracking, users, orders, and return/exchange requests.

```mermaid
erDiagram
    users {
        string id PK
        string name
        string email
        string_array paymentMethods
    }

    orders {
        string id PK
        string userId FK
        string status
        object_array items
        object_array paymentHistory
        date createdAt
        date updatedAt
    }

    return_requests {
        string id PK
        string returnId
        string orderId FK
        string userId FK
        string type
        string status
        string action
        string paymentMethodId
        object_array items
        date createdAt
        date updatedAt
    }

    products {
        string id PK
        string name
        string category
        double price
        integer stock
        date createdAt
        date updatedAt
    }

    order_tracking {
        string id PK
        string orderId FK
        string event
        string message
        date createdAt
        date updatedAt
    }

    users ||--o{ orders : places
    users ||--o{ return_requests : submits
    orders ||--o{ return_requests : relates_to
    orders ||--o{ order_tracking : tracks
    products ||--o{ orders : "referenced in items"
    products ||--o{ return_requests : "referenced in items"
```

## Smart Return and Exchange Use Case Diagram

This diagram outlines the interactions between Customer, Admin, and the AI Agent (LangGraph) within the system boundary.

```mermaid
graph LR
    %% Actors
    Customer((Customer))
    Admin((Admin))
    Agent((AI Agent))

    subgraph System Boundary
        UC_Chat(Request Return/Exchange via Chat)
        UC_Confirm(Confirm Exchange Details)
        UC_Track(Track Order Status)
        UC_SubmitUI(Submit Request via UI)
        
        UC_VerifyOrder(Verify Order & Items via Tool)
        UC_VerifyPay(Verify Payment Methods via Tool)
        UC_CreateAPI(Create Request via REST API)
        
        UC_Config(Configure Policy Rules)
        UC_Manual(Review Manual Decisions)
        UC_RunExp(Run Policy Experiments)
    end

    %% Relations
    Customer --> UC_Chat
    Customer --> UC_Confirm
    Customer --> UC_Track
    Customer --> UC_SubmitUI

    Agent --> UC_Chat
    Agent --> UC_Confirm
    Agent --> UC_VerifyOrder
    Agent --> UC_VerifyPay
    Agent --> UC_CreateAPI

    Admin --> UC_Config
    Admin --> UC_Manual
    Admin --> UC_RunExp
```



