@el
def intro():
    return f"""md
    # Test

    - what?
        - id/name

    `stg_customers`: their `id`.

    {
        sql(f"""
            from stg_customers
            left join stg_orders using (customer_id)
            limit 5
        """)
    }

    """

def after_md():
    pass


def render_page():
    return f"""html
    <div class="container">
        <!-- header comment -->
        <h1>Hello</h1>
        <p>World</p>
    </div>
    """

def after_html():
    pass


def run_query():
    return f"""sql
    select
        u.id,
        u.name
    from users u
    where u.active = 1
    """

def run_query_dash():
    return f"""--sql
    select
        u.id,
        u.name
    from users u
    where u.active = 1
    """

def after_query_dash():
    pass


def after_sql():
    pass


def use_sql_func():
    result = sql("select * from users where id = 1")
    return result


def use_sql_triple():
    result = sql("""
        select id, name
        from users
        where active = 1
    """)
    return result


def use_plot():
    result = plot("SELECT count(*) FROM users", conn)
    return result


def complex_expr():
    return f"""md
    Use `deff` to build data transformation graph.

    {
        el(stg_customers | 'limit 5')
        | el(stg_orders | 'limit 5')
        | el(stg_payments | 'limit 5')
    }

    ```sql
    FROM {{jaffle_shop.stg_customers}}
    LEFT JOIN {{jaffle_shop.stg_orders}} USING (customer_id)
    LEFT JOIN {{jaffle_shop.stg_payments}} USING (order_id)
    ```

    {el(
        sql(f"""
            from {stg_customers}
            left join {stg_orders} using (customer_id)
            left join {stg_payments} using (order_id)
            limit 5
        """)
    )}

    """

def after_all():
    pass


def use_el():
    some_code = el("""md
    We can show the graph like this:

    ```python
    @tbl
    def table():
      return ...

    table.graph
    ```
    """)

def after_el():
    pass


@el
def staging_tables():
    return '''md
    ```python
    @tbl
    def stg_orders(path=orders_path):
        return f"""--sql
        from '{path}'
        select
            id as order_id,
            user_id as customer_id,
            order_date,
            status
        """

    @tbl
    def stg_payments(path=payments_path):
        return f"""--sql
        from '{path}'
        select
            id as payment_id,
            order_id,
            payment_method,
            amount / 100 as amount
        """

    @tbl
    def stg_customers(path=customers_path):
        return f"""--sql
        from '{path}'
        select
            id as customer_id,
            first_name,
            last_name
        """
        ```
    '''

def after_singleq_md():
    pass
