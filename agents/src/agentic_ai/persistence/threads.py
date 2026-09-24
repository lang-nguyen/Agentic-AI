from langgraph.store.base import BaseStore

async def save_customer_thread(
    store: BaseStore,
    user_id: str,
    thread_id: str,
):
    customer_store = await store.aget(
        namespace=("customer_threads",),
        key=user_id,
    )

    customer_threads = []

    if customer_store:
        customer_threads = customer_store.value.get("threads", [])

    # Avoid duplicate thread
    if not any(
        thread.get("thread_id") == thread_id
        for thread in customer_threads
    ):
        customer_threads.append(
            {
                "thread_id": thread_id,
                "status": "new",
            }
        )

    await store.aput(
        namespace=("customer_threads",),
        key=user_id,
        value={
            "threads": customer_threads
        }
    )

async def save_guest_thread(
    store: BaseStore,
    thread_id: str
):
    await store.aput(
        namespace=("guest_threads",),
        key=thread_id,
        value={
            "threads": [
                {
                    "thread_id": thread_id,
                }
            ]
        }
    )

async def save_staff_thread(
    store: BaseStore,
    staff_id: str,
    staff_thread_id: str,
    customer_thread_id: str,
):
    staff_record = await store.aget(
        namespace=("staff_threads",),
        key=staff_id,
    )

    staff_threads = []

    if staff_record:
        staff_threads = staff_record.value.get("threads", [])

    # Avoid duplicate thread mapping
    if not any(
        thread.get("thread_id") == staff_thread_id
        and thread.get("customer_thread_id") == customer_thread_id
        for thread in staff_threads
    ):
        staff_threads.append(
            {
                "thread_id": staff_thread_id,
                "customer_thread_id": customer_thread_id,
            }
        )

    await store.aput(
        namespace=("staff_threads",),
        key=staff_id,
        value={
            "threads": staff_threads
        }
    )