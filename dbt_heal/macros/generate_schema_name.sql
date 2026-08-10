{% macro generate_schema_name(custom_schema_name, node) -%}
  {#- Use custom schema as the real Snowflake schema (not target_custom). -#}
  {%- if custom_schema_name is none -%}
    {{ target.schema }}
  {%- else -%}
    {{ custom_schema_name | trim }}
  {%- endif -%}
{%- endmacro %}
