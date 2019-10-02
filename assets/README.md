##### Usando o aplicativo

#### Sincronizações automáticas

Por padrão sincronizações automáticas estão desabilitadas. Após a instalação do aplicativo é necessário escolher o que será sincronizado (`produtos`, `pedidos`, `estoque`) da E-Com Plus para o Tiny vice-versa.

- Produtos
  - Envia todas as informações dos produtos existentes ou novos; estoque, variações.
- Pedidos
  - Envia todas as informações dos pedidos existentes e novos pedidos.
- Estoque
  -  Mantem o estoque da E-Com Plus Atualizado com o estoque do produto no Tiny.

#### Sincronizações manual

É possível enviar produtos e pedidos manualmente entre as plataformas, confira abaixo;
> E-Com Plus para Tiny

 Método |Resource | Descrição | API Url | Body
--------|---------|-----------|---------|-----
** GET**  | Products | Busca informações específicas do produto no banco de dados. *OBS: parâmetro `_id` deve se referir ao ObjectId do produto da [E-Com Plus Store API](https://developers.e-com.plus/docs/api/#/store/products/).* | `/ecom/products/:_id` | `{}` 
**POST** | Products | Envia da E-Com Plus para o Tiny os produtos referentes aos _ids informados no array. | `/ecom/products` | `["5d1a34fe6a3fa57d5fd349ee", "5c700e82c626be23430d4fa7"]`
**PATCH** | Products | Atualiza dados do produto no Tiny. *OBS: parâmetro `_id` deve se referir ao ObjectId do produto da [E-Com Plus Store API](https://developers.e-com.plus/docs/api/#/store/products/).*  | `/ecom/products/:_id` | *O corpo da solicitação deve seguir o seguinte modelo [E-Com Plus Store API](https://developers.e-com.plus/docs/api/#/store/products/)*
**DELETE** | Products | Deleta produto do banco de dados do aplicativo e inclui o produto na lista de excluídos. *OBS: parâmetro `_id` deve se referir ao ObjectId do produto da [E-Com Plus Store API](https://developers.e-com.plus/docs/api/#/store/products/).* | `/ecom/products/:_id` | `{}`
**GET** | Unwatched | Retorna lista de produtos que estão excluídos da sincronização. | `/ecom/unwatched` | `{}`
**POST** | Unwatched | Envia uma lista de produtos que não serão sincronizados | `/ecom/unwatched` | `["5d1a34fe6a3fa57d5fd349ee", "5c700e82c626be23430d4fa7"]`
** DELETE ** | Unwatched | Remove produto da lista de excluidos e retoma a sincronização do mesmo. | `/ecom/unwatched` | `["5d1a34fe6a3fa57d5fd349ee", "5c700e82c626be23430d4fa7"]`
**POST** | Orders | Envia da E-Com Plus para o Tiny pedidos referente aos ids informados. | `/ecom/products` | `["5d1a34fe6a3fa57d5fd349ee", "5c700e82c626be23430d4fa7"]`

> Tiny para E-Com Plus

