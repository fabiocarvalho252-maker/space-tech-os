-- Inserir o termo de garantia padrão de 90 dias conforme a lei brasileira (CDC)
INSERT INTO public.termos_garantia (titulo, conteudo, is_default)
VALUES (
    'Garantia Legal - 90 Dias',
    'De acordo com o Artigo 26 do Código de Defesa do Consumidor (Lei nº 8.078/90), este aparelho possui garantia legal de 90 (noventa) dias contra defeitos de fabricação. A garantia não cobre danos causados por mau uso, contato com líquidos, quedas, ou intervenções por assistências não autorizadas. A apresentação deste termo ou da nota fiscal é indispensável para o atendimento.',
    true
)
ON CONFLICT DO NOTHING;
