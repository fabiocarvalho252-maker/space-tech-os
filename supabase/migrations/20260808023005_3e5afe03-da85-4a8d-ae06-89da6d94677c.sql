INSERT INTO public.termos_garantia (user_id, titulo, conteudo, is_default)
VALUES (
    'f6d56c5e-16c9-4610-bbd2-73a03021423e',
    'Garantia Legal - 90 Dias',
    'De acordo com o Artigo 26 do Código de Defesa do Consumidor (Lei nº 8.078/90), este aparelho possui garantia legal de 90 (noventa) dias contra defeitos de fabricação. A garantia não cobre danos causados por mau uso, contato com líquidos, quedas, ou intervenções por assistências não autorizadas. A apresentação deste termo ou da nota fiscal é indispensável para o atendimento.',
    true
)
ON CONFLICT DO NOTHING;